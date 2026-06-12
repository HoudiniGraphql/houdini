import { deepEquals } from 'houdini/runtime'
import { fragmentKey } from 'houdini/runtime'
import type { GraphQLObject, GraphQLVariables, FragmentArtifact } from 'houdini/runtime'
import * as React from 'react'

import { useRouterContext } from '../routing/index.js'
import { useDocumentSubscription } from './useDocumentSubscription.js'

export function useFragment<
	_Data extends GraphQLObject,
	_ReferenceType extends {},
	_Input extends GraphQLVariables = GraphQLVariables,
>(
	reference: _Data | { ' $fragments': _ReferenceType } | null,
	document: { artifact: FragmentArtifact }
): _Data | null {
	const { cache } = useRouterContext()

	// get the fragment reference info
	const { parent, variables, loading } = fragmentReference<_Data, _Input, _ReferenceType>(
		reference,
		document
	)

	// Read from cache only when the parent (or loading state) changes — not on every render.
	// For embedded records the parent path encodes the cursor, so it uniquely identifies
	// which page's data we need; variables are passed through for non-embedded fragments.
	// biome-ignore lint/correctness/useExhaustiveDependencies: variables intentionally excluded (parent encodes effective key)
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

	// we're ready to setup the live document
	const [storeValue, observer] = useDocumentSubscription<FragmentArtifact, _Data, _Input>({
		artifact: document.artifact,
		variables,
		initialValue: cachedValue,
		// dont subscribe to anything if we are loading
		disabled: loading,
		send: {
			stuff: {
				parentID: parent,
			},
			setup: true,
		},
	})

	// Relay's "handleMissedUpdates" pattern: the setup:true backward pass uses this.state
	// which may be stale (old parent's data). Cache data for the new parent may also have
	// been written before the subscription was established. This effect runs after
	// useDocumentSubscription's effect (guaranteed by hook registration order) and corrects
	// any stale observer state by reading from cache once for the new parent.
	// biome-ignore lint/correctness/useExhaustiveDependencies: cache and observer are stable; variables captured via closure
	React.useEffect(() => {
		if (!parent || loading) return
		const result = cache.read({
			selection: document.artifact.selection,
			parent,
			variables,
			loading,
		})
		if (result.data !== null) {
			observer.set({
				data: result.data as _Data,
				errors: null,
				fetching: false,
				partial: false,
				stale: false,
				source: null,
				variables: variables ?? null,
			})
		}
	}, [parent, loading])

	// On a parent change, return cachedValue immediately so the component shows fresh data
	// before the subscription catches up. Once the missed-updates effect above has fired and
	// the observer reflects the new parent, storeValue.data is authoritative.
	const lastReference = React.useRef<{ parent: string; variables: _Input } | null>(null)
	return React.useMemo(() => {
		const parentChange = !deepEquals({ parent, variables }, lastReference.current)
		if (parentChange) {
			lastReference.current = { parent, variables: { ...variables } }
			return cachedValue
		}
		return storeValue.data
	}, [variables, parent, storeValue.data, cachedValue])
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
