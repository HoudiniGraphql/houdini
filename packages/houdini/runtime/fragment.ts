// externals
import { readable, Readable } from 'svelte/store'
import { onMount } from 'svelte'
// locals
import type { Fragment, FragmentArtifact, GraphQLTagResult, SubscriptionSpec } from './types'
import cache from './cache'
import { getVariables } from './context'

// fragment returns the requested data from the reference
export default function fragment<_Fragment extends Fragment<any>>(
	fragment: GraphQLTagResult,
	initialValue: _Fragment
): Readable<_Fragment['shape']> {
	// make sure we got a query document
	if (fragment.kind !== 'HoudiniFragment') {
		throw new Error('getFragment can only take fragment documents')
	}
	// we might get the the artifact nested under default
	const artifact: FragmentArtifact =
		// @ts-ignore: typing esm/cjs interop is hard
		fragment.artifact.default || fragment.artifact

	let subscriptionSpec: SubscriptionSpec | undefined

	const queryVariables = getVariables()

	// wrap the result in a store we can use to keep this query up to date
	const value = readable(initialValue, (set) => {
		// @ts-ignore: isn't properly typed yet to know if initialValue has
		// what it needs to compute the id
		const parentID = cache.id(artifact.rootType, initialValue)

		subscriptionSpec = {
			rootType: artifact.rootType,
			selection: artifact.selection,
			set,
			parentID,
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
					},
					queryVariables()
				)
			}
		}
	})

	return value
}
