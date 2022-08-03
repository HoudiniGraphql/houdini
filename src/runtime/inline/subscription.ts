import { onDestroy } from 'svelte'
import { Readable } from 'svelte/store'

import { isBrowser } from '../adapter'
import { Operation, GraphQLTagResult } from '../lib/types'

// subscription holds open a live connection to the server. it returns a store
// containing the requested data. Houdini will also update the cache with any
// information that it encounters in the response.
export function subscription<_Subscription extends Operation<any, any>>(
	store: GraphQLTagResult,
	variables?: _Subscription['input']
): {
	data: Readable<_Subscription['result']>
} {
	// make sure we got a query document
	if (store.kind !== 'HoudiniSubscription') {
		throw new Error('subscription() must be passed a subscription document')
	}

	// an inline document's value is just the store
	const value = { data: { subscribe: store.subscribe } }

	// invoking subscription on the server doesn't do anything
	if (!isBrowser) {
		return value
	}

	// every invocation should just be pushed to the store
	store.listen(variables)

	onDestroy(() => {
		store.unlisten()
	})

	return value
}
