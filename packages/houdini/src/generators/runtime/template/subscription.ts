// externals
import { readable, Readable } from 'svelte/store'
import { onMount } from 'svelte'
// locals
import { Operation, GraphQLTagResult } from './types'
import { getEnvironment } from './network'
import cache from './cache'

// subscription holds open a live connection to the server. it returns a store
// containing the requested data as well as updates the cache when new data
// is encountered
export default function subscription<_Subscription extends Operation<any, any>>(
	document: GraphQLTagResult,
	variables: _Subscription['input']
): Readable<_Subscription['result']> {
	// make sure we got a query document
	if (document.kind !== 'HoudiniSubscription') {
		throw new Error('subscription() must be passed a subscription document')
	}

	// pull out the current environment
	const env = getEnvironment()
	// if there isn't one, yell loudly
	if (!env) {
		throw new Error('Could not find network environment')
	}

	// pull the query text out of the compiled artifact
	const { raw: text, selection } = document.artifact

	// the primary function of a subscription is to keep the cache
	// up to date with the response

	// we need a place to hold the results that the client can use
	const store = readable(null, (set) => {
		// the websocket connection only exists on the client
		onMount(() => {
			env.subscription(text, {
				next(data: _Subscription['result']) {
					// update the cache with the result
					cache.write(selection, data, variables)

					// update the local store
					set(data)
				},
				error(data: _Subscription['result']) {},
				complete() {},
			})
		})
	})

	return store
}
