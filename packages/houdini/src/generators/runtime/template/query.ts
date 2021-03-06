// externals
import { readable, Readable } from 'svelte/store'
import { onMount } from 'svelte'
// locals
import { Operation, GraphQLTagResult } from './types'
import cache from './cache'

export default function query<_Query extends Operation<any, any>>(
	document: GraphQLTagResult
): Readable<_Query['result']> {
	// make sure we got a query document
	if (document.kind !== 'HoudiniQuery') {
		throw new Error('getQuery can only take query operations')
	}

	// if there is no initial value
	if (!document.initialValue) {
		// we're done
		return readable(null, () => {})
	}

	// wrap the result in a store we can use to keep this query up to date
	const value = readable(
		document.processResult(document.initialValue.data, document.variables),
		(set) => {
			// when the component monuts
			onMount(() => {
				// write the data we loaded to the cache
				cache.write(document.responseInfo, document.initialValue.data)
			})

			// the function used to clean up the store
			return () => {
				console.log('unregister')
			}
		}
	)

	return value
}
