import { fragmentKey } from 'houdini/runtime'
import type {
	GraphQLObject,
	GraphQLVariables,
	FragmentArtifact,
	QueryResult,
	SubscriptionSpec,
} from 'houdini/runtime'
import * as React from 'react'

import { useRouterContext } from '../routing/index.js'
import { useDocumentSubscription } from './useDocumentSubscription.js'

// useFragment reads a fragment's data back out of the cache. When the fragment is marked
// @plural it is spread on a list field, so the reference is an array of fragment references
// and the hook returns an array of data (see usePluralFragment below).

// plural overloads: the reference is an array of fragment references
export function useFragment<
	_Data extends GraphQLObject,
	_ReferenceType extends {},
	_Input extends GraphQLVariables = GraphQLVariables,
>(
	reference: ReadonlyArray<_Data | { ' $fragments': _ReferenceType }>,
	document: { artifact: FragmentArtifact }
): _Data[]
export function useFragment<
	_Data extends GraphQLObject,
	_ReferenceType extends {},
	_Input extends GraphQLVariables = GraphQLVariables,
>(
	reference: ReadonlyArray<_Data | { ' $fragments': _ReferenceType }> | null,
	document: { artifact: FragmentArtifact }
): _Data[] | null

// singular overload: the reference is a single fragment reference
export function useFragment<
	_Data extends GraphQLObject,
	_ReferenceType extends {},
	_Input extends GraphQLVariables = GraphQLVariables,
>(
	reference: _Data | { ' $fragments': _ReferenceType } | null,
	document: { artifact: FragmentArtifact }
): _Data | null

export function useFragment(reference: any, document: { artifact: FragmentArtifact }): any {
	const plural = Boolean(document.artifact.plural)

	// Both implementations run on every render so the rules of hooks are preserved; the one
	// that isn't relevant is fed a null reference and becomes a no-op. Which result we return
	// is keyed off the static @plural artifact flag, so a given call-site is always consistent.
	const singularResult = useSingularFragment(plural ? null : reference, document)
	const pluralResult = usePluralFragment(plural ? (reference ?? null) : null, document)

	return plural ? pluralResult : singularResult
}

function useSingularFragment<
	_Data extends GraphQLObject,
	_ReferenceType extends {},
	_Input extends GraphQLVariables = GraphQLVariables,
>(
	reference: _Data | { ' $fragments': _ReferenceType } | null,
	document: { artifact: FragmentArtifact }
): _Data | null {
	const { cache } = useRouterContext()
	const { parent, variables, loading } = fragmentReference<_Data, _Input, _ReferenceType>(
		reference,
		document
	)

	// Read from cache whenever the parent or loading state changes. The parent
	// path uniquely identifies which cache record this fragment is bound to, so
	// variables are excluded from the dep array — they are forwarded to
	// observer.send() separately and don't affect which record we read.
	// biome-ignore lint/correctness/useExhaustiveDependencies: variables intentionally excluded
	const cachedValue = React.useMemo(() => {
		if (reference && parent) {
			return cache.read({
				selection: document.artifact.selection,
				parent,
				variables,
				loading,
			}).data as _Data
		}
		return reference as _Data | null
	}, [parent, loading])

	// Stable initialState derived from cachedValue. useDocumentStore uses this to
	// seed box.current synchronously during render when the parent changes, so
	// storeValue.data is immediately correct without waiting for the subscription
	// effect to fire. Must be memoized (reference-stable) so the store doesn't
	// re-seed on every render.
	// biome-ignore lint/correctness/useExhaustiveDependencies: variables changes don't require re-seeding
	const initialState = React.useMemo(
		(): QueryResult<_Data, _Input> | undefined =>
			cachedValue !== null
				? {
						data: cachedValue,
						errors: null,
						fetching: false,
						partial: false,
						stale: false,
						source: null,
						variables: variables ?? null,
					}
				: undefined,
		[cachedValue]
	)

	const [storeValue] = useDocumentSubscription<FragmentArtifact, _Data, _Input>({
		artifact: document.artifact,
		variables,
		initialValue: cachedValue,
		// no parent means there is nothing to subscribe to (eg a null reference, or this
		// singular hook running in no-op mode for a @plural fragment)
		disabled: loading || !parent,
		send: {
			stuff: {
				parentID: parent,
			},
			setup: true,
		},
		initialState,
	})

	return storeValue.data
}

// usePluralFragment consumes a @plural fragment: the reference is an array of fragment
// references (one per item in the list the fragment was spread on). Each item is bound to
// its own cache record, so we keep the list in state and register one cache subscription
// per item inside a single effect. A subscription message carries the new value for just
// that record, so we patch it into the list in place rather than re-reading everything.
// Doing the subscriptions in one effect keeps the hook count stable regardless of how many
// items the list contains (we can't call a hook per item).
function usePluralFragment<
	_Data extends GraphQLObject,
	_ReferenceType extends {},
	_Input extends GraphQLVariables = GraphQLVariables,
>(
	references: ReadonlyArray<_Data | { ' $fragments': _ReferenceType }> | null,
	document: { artifact: FragmentArtifact }
): _Data[] | null {
	const { cache } = useRouterContext()
	const artifact = document.artifact

	// resolve the cache record + variables for each reference in the list
	// biome-ignore lint/correctness/useExhaustiveDependencies: document is a stable import
	const entries = React.useMemo(
		() =>
			references
				? references.map((reference) =>
						fragmentReference<_Data, _Input, _ReferenceType>(reference, document)
					)
				: null,
		[references]
	)

	// a stable key describing which records (and variables) we are bound to, so we only
	// re-seed and re-subscribe when the set of records actually changes (eg an insert/remove)
	const subscriptionKey = entries
		? entries
				.map((entry) => `${entry.parent}:${JSON.stringify(entry.variables ?? {})}`)
				.join('|')
		: ''

	// read every item from the cache. used to seed the list, and to re-seed it when the set
	// of records changes (membership changes don't necessarily message the existing records).
	const readAll = (): _Data[] | null => {
		if (!references || !entries) {
			return null
		}
		return entries.map(({ parent, variables, loading }, i) =>
			parent
				? (cache.read({ selection: artifact.selection, parent, variables, loading })
						.data as _Data)
				: (references[i] as _Data)
		)
	}

	const [data, setData] = React.useState<_Data[] | null>(readAll)

	// the subscriptionKey the current `data` was seeded for; starts matching the initial
	// useState seed so we don't redundantly re-seed on mount
	const seededKey = React.useRef(subscriptionKey)

	// re-seed when the set of records changes, then subscribe to each record individually.
	// onMessage carries the new value for just that record, so we patch it in place.
	// biome-ignore lint/correctness/useExhaustiveDependencies: keyed on subscriptionKey
	React.useEffect(() => {
		if (seededKey.current !== subscriptionKey) {
			seededKey.current = subscriptionKey
			setData(readAll())
		}

		if (!entries) {
			return
		}

		const specs: SubscriptionSpec[] = []
		entries.forEach(({ parent, variables, loading }, index) => {
			if (!parent || loading) {
				return
			}
			const spec: SubscriptionSpec = {
				rootType: artifact.rootType,
				kind: artifact.kind,
				selection: artifact.selection,
				parentID: parent,
				variables: () => variables ?? {},
				onMessage: (message) => {
					// only a cache write ('update') carries a new value for this record. other
					// messages (eg 'refetch' from cache.refresh()) don't apply to a fragment,
					// which has no refetch of its own; the refreshed value arrives as an 'update'.
					if (message.kind !== 'update') {
						return
					}
					setData((current) => {
						if (!current) {
							return current
						}
						const next = current.slice()
						next[index] = message.data as _Data
						return next
					})
				},
			}
			cache.subscribe(spec)
			specs.push(spec)
		})

		return () => {
			for (const spec of specs) {
				cache.unsubscribe(spec)
			}
		}
	}, [subscriptionKey])

	return data
}

export function fragmentReference<_Data extends GraphQLObject, _Input, _ReferenceType extends {}>(
	reference: _Data | { ' $fragments': _ReferenceType } | null,
	document: { artifact: FragmentArtifact }
): { variables: _Input; parent: string; loading: boolean } {
	// @ts-expect-error: typescript can't guarantee that the fragment key is defined
	// but if its not, then the fragment wasn't mixed into the right thing
	// the variables for the fragment live on the initial value's $fragment key
	const { variables, parent } = reference?.[fragmentKey]?.values?.[document.artifact.name] ?? {}
	if (reference && fragmentKey in reference && (!variables || !parent)) {
		console.warn(
			`⚠️ Parent does not contain the information for this fragment. Something is wrong.
Please ensure that you have passed a record that has ${document.artifact.name} mixed into it.`
		)
	}
	// @ts-expect-error
	const loading = Boolean(reference?.[fragmentKey]?.loading)

	return { variables, parent, loading }
}
