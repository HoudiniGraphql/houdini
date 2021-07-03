// externals
import { readable, Readable } from 'svelte/store'
import { onMount } from 'svelte'
import type { Config } from 'houdini-common'
// locals
import type { Fragment, FragmentArtifact, GraphQLTagResult, SubscriptionSpec } from './types'
import cache from './cache'
import { getVariables } from './context'
import { unmarshalSelection } from './scalars'

// fragment returns the requested data from the reference
export default function fragment<_Fragment extends Fragment<any>>(
	fragment: GraphQLTagResult,
	initialValue: _Fragment
): Readable<_Fragment['shape']> {
	// make sure we got a query document
	if (fragment.kind !== 'HoudiniFragment') {
		throw new Error('getFragment can only take fragment documents')
	}

	// we might get re-exported values nested under default

	// @ts-ignore: typing esm/cjs interop is hard
	const artifact: FragmentArtifact = fragment.artifact.default || fragment.artifact

	const queryVariables = getVariables()

	// @ts-ignore: isn't properly typed yet to know if initialValue has the right values
	const parentID = cache.id(artifact.rootType, initialValue)

	// load the fragment data from the cache
	const initialStoreValue = cache.internal.getData(
		cache.internal.record(parentID),
		artifact.selection,
		queryVariables()
	)

	let subscriptionSpec: SubscriptionSpec | undefined
	// wrap the result in a store we can use to keep this query up to date
	const value = readable(initialStoreValue, (set) => {
		subscriptionSpec = {
			rootType: artifact.rootType,
			selection: artifact.selection,
			set,
			parentID,
			variables: queryVariables,
		}

		// when the component mounts
		onMount(() => {
			// if there is an id we can anchor the cache off of
			if (parentID && subscriptionSpec) {
				// stay up to date
				cache.subscribe(subscriptionSpec, queryVariables())
			}
		})

		// the function used to clean up the store
		return () => {
			// if we subscribed to something we'll need to clean up
			if (parentID) {
				cache.unsubscribe(
					{
						rootType: artifact.rootType,
						parentID,
						selection: artifact.selection,
						set,
						variables: queryVariables,
					},
					queryVariables()
				)
			}
		}
	})

	return value
}
