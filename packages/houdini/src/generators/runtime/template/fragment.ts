// externals
import { readable, Readable } from 'svelte/store'
import { onMount } from 'svelte'
// locals
import type { Fragment, GraphQLTagResult } from './types'
import cache from './cache'
import { getVariables } from './context'

// fragment returns the requested data from the reference
export default function fragment<_Fragment extends Fragment<any>>(
	fragment: GraphQLTagResult,
	data: _Fragment
): Readable<_Fragment['shape']> {
	// make sure we got a query document
	if (fragment.artifact.kind !== 'HoudiniFragment') {
		throw new Error('getFragment can only take fragment documents')
	}

	const variables = getVariables()

	// wrap the result in a store we can use to keep this query up to date
	const value = readable(data, (set) => {
		// @ts-ignore
		const parentID = cache.id(fragment.artifact.rootType, data)

		// when the component monuts
		onMount(() => {
			// if there is an id we can anchor the cache off of
			if (parentID) {
				// stay up to date
				cache.subscribe(
					{
						rootType: fragment.artifact.rootType,
						selection: fragment.artifact.selection,
						set,
						parentID,
					},
					variables
				)
			}
		})

		// the function used to clean up the store
		return () => {
			// if we subscribed to something we'll need to clean up
			if (parentID) {
				cache.unsubscribe(
					{
						rootType: fragment.artifact.rootType,
						parentID,
						selection: fragment.artifact.selection,
						set,
					},
					variables
				)
			}
		}
	})

	return value
}
