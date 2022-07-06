// externals
import { Readable } from 'svelte/store'
import { onDestroy } from 'svelte'
// locals
import { Operation, GraphQLTagResult } from '../lib/types'
import { isBrowser } from '../adapter'

// subscription holds open a live connection to the server. it returns a store
// containing the requested data. Houdini will also update the cache with any
// information that it encounters in the response.
export function subscription<_Subscription extends Operation<any, any>>(
	document: GraphQLTagResult,
	variables?: _Subscription['input']
): {
	data: Readable<_Subscription['result']>
} {
	// make sure we got a query document
	if (document.kind !== 'HoudiniSubscription') {
		throw new Error('subscription() must be passed a subscription document')
	}

	// an inline document's value is just the store
	const value = { data: { subscribe: document.store.subscribe } }

	// invoking subscription on the server doesn't do anything
	if (!isBrowser) {
		return value
	}

	// every invocation should just be pushed to the store
	document.store.listen(variables)

	onDestroy(() => {
		document.store.unlisten()
	})

	return value
}
