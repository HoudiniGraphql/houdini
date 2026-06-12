import { fragmentKey } from 'houdini/runtime'
import type {
	GraphQLObject,
	GraphQLVariables,
	FragmentArtifact,
	QueryResult,
} from 'houdini/runtime'
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
		disabled: loading,
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

export function fragmentReference<
	_Data extends GraphQLObject,
	_Input,
	_ReferenceType extends {},
>(
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
