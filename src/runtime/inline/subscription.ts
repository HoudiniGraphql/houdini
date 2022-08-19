import { onDestroy } from 'svelte'
import { Readable } from 'svelte/store'

import { isBrowser } from '../adapter'
import { Operation, GraphQLTagResult } from '../lib/types'
import { SubscriptionStore } from '../stores'

// subscription holds open a live connection to the server. it returns a store
// containing the requested data. Houdini will also update the cache with any
// information that it encounters in the response.
export function subscription<_Subscription extends Operation<_Data, _Input>, _Data, _Input>(
	store: GraphQLTagResult,
	variables?: _Subscription['input']
): {
	data: Readable<_Subscription['result']>
} {
	// make sure we got a query document
	if (store.kind !== 'HoudiniSubscription') {
		throw new Error('subscription() must be passed a subscription document')
	}
	const subscriptionStore = store as Required<SubscriptionStore<any, any>>

	// an inline document's value is just the store
	const value = {
		data: { subscribe: subscriptionStore.subscribe },
	}

	// invoking subscription on the server doesn't do anything
	if (!isBrowser) {
		return value
	}

	// we know we have a subscription store but typescript can't discriminated on kind with classes :(
	const subStore = store as SubscriptionStore<any, any>

	// every invocation should just be pushed to the store
	subStore.listen(variables)

	onDestroy(() => {
		subStore.unlisten()
	})

	return value
}
