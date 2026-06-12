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

	// Track the last parent we've fully committed to. While the parent has changed (new record,
	// observer hasn't caught up yet) we return cachedValue; once effects fire and the observer
	// is current we fall through to storeValue.data.
	const [lastParent, setLastParent] = React.useState<string | undefined>(undefined)
	const parentChanged = parent !== lastParent

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
	const [storeValue] = useDocumentSubscription<FragmentArtifact, _Data, _Input>({
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
		// Passed outside send so it doesn't participate in the deep-equals dep comparison.
		// Seeds the setup:true backward pass with the correct data for the current parent
		// rather than stale this.state from a previous parent.
		initialState: cachedValue !== null
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
	})

	// Advance lastParent after the subscription effect fires so that on the next render
	// storeValue.data (now correct, because initialState seeded the backward pass) is used.
	// biome-ignore lint/correctness/useExhaustiveDependencies: setLastParent is stable
	React.useEffect(() => {
		if (parentChanged) setLastParent(parent)
	}, [parent])

	// Return cachedValue when the parent just changed (before the observer has caught up),
	// otherwise defer to the live storeValue.
	return parentChanged ? cachedValue : storeValue.data
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
