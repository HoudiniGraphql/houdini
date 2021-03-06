// externals
import { readable, Readable } from 'svelte/store'
import { onMount } from 'svelte'
// locals
import type { Fragment, GraphQLTagResult } from './types'
import { getVariables } from './context'
import cache from './cache'

// fragment returns the requested data from the reference
export default function fragment<_Fragment extends Fragment<any>>(
	fragment: GraphQLTagResult,
	data: _Fragment
): Readable<_Fragment['shape']> {
	// make sure we got a query document
	if (fragment.kind !== 'HoudiniFragment') {
		throw new Error('getFragment can only take fragment documents')
	}

	const variables = getVariables()

	// wrap the result in a store we can use to keep this query up to date
	const value = readable(data, (set) => {
		// when the component monuts
		onMount(() => {
			// @ts-ignore
			const parentID = cache.id(fragment.selection.rootType, data)

			// if there is an id we can anchor the cache off of
			if (parentID) {
				// stay up to date
				cache.subscribe({
					selection: fragment.selection,
					set,
					parentID,
				})
			}
		})

		// the function used to clean up the store
		return () => {}
	})

	return value
}
