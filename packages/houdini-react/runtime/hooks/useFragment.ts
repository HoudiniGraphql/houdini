import { fragmentKey } from '$houdini/runtime/lib/types'
import type { GraphQLObject, GraphQLVariables, FragmentArtifact } from '$houdini/runtime/lib/types'
import { deepEquals } from 'houdini/src/runtime/lib/deepEquals'
import * as React from 'react'

import { useRouterContext } from '../routing'
import { useDeepCompareMemoize } from './useDeepCompareEffect'
import { useDocumentSubscription } from './useDocumentSubscription'

export function useFragment<
	_Data extends GraphQLObject,
	_ReferenceType extends {},
	_Input extends GraphQLVariables = GraphQLVariables
>(
	reference: _Data | { [fragmentKey]: _ReferenceType } | null,
	document: { artifact: FragmentArtifact }
) {
	const { cache } = useRouterContext()

	// get the fragment reference info
	const { parent, variables, loading } = fragmentReference<_Data, _Input, _ReferenceType>(
		reference,
		document
	)

	// if we got this far then we are safe to use the fields on the object
	let cachedValue = reference as _Data | null

	// on the client, we want to ensure that we apply masking to the initial value by
	// loading the value from cache
	if (reference && parent) {
		cachedValue = cache.read({
			selection: document.artifact.selection,
			parent,
			variables,
			loading,
		}).data as _Data
	}

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
	})

	// the parent has changed, we need to use initialValue for this render
	// if we don't, then there is a very brief flash where we will show the old data
	// before the store has had a chance to update
	const lastReference = React.useRef<{ parent: string; variables: _Input } | null>(null)
	return React.useMemo(() => {
		// if the parent reference has changed we need to always prefer the cached value
		const parentChange =
			storeValue.parent !== parent ||
			!deepEquals({ parent, variables }, lastReference.current)
		if (parentChange) {
			// make sure we keep track of the last reference we used
			lastReference.current = { parent, variables: { ...variables } }

			// and use the cached value
			return cachedValue
		}

		return storeValue.data
	}, [
		useDeepCompareMemoize({
			parent,
			variables,
			cachedValue,
			storeValue: storeValue.data,
			storeParent: storeValue.parent,
		}),
	])
}

export function fragmentReference<_Data extends GraphQLObject, _Input, _ReferenceType extends {}>(
	reference: _Data | { [fragmentKey]: _ReferenceType } | null,
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
