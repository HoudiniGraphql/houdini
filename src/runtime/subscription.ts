// externals
import { Readable, writable } from 'svelte/store'
import { onMount, onDestroy } from 'svelte'
// locals
import type { ConfigFile } from './config'
import { Operation, GraphQLTagResult, SubscriptionArtifact } from './types'
import { getCurrentClient } from './network'
import cache from './cache'
import { marshalInputs, unmarshalSelection } from './scalars'

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

	// the websocket connection only exists on the client
	onMount(() => {
		document.store.subscribe(variables)
	})

	onDestroy(() => {
		document.store.unsubscribe()
	})

	return { data: { subscribe: document.store.subscribe } }
}
