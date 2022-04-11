// externals
import { Readable, writable } from 'svelte/store'
import { onMount, onDestroy } from 'svelte'
// locals
import type { Config } from '../common'
import { Operation, GraphQLTagResult, SubscriptionArtifact } from './types'
import { getEnvironment } from './network'
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

	// we might get re-exported values nested under default

	// @ts-ignore: typing esm/cjs interop is hard
	const artifact: SubscriptionArtifact = document.artifact.default || document.artifact
	// @ts-ignore: typing esm/cjs interop is hard
	const config: Config = document.config.default || document.config

	// pull out the current environment
	const env = getEnvironment()
	// if there isn't one, yell loudly
	if (!env) {
		throw new Error('Could not find network environment')
	}

	// pull the query text out of the compiled artifact
	const { raw: text, selection } = artifact

	// the primary function of a subscription is to keep the cache
	// up to date with the response
	// we need a place to hold the results that the client can use
	const store = writable<_Subscription['result'] | null>(null)

	// the function to call that unregisters the subscription
	let unsubscribe: () => void

	let marshaledVariables = {}
	$: marshaledVariables = marshalInputs({
		input: variables || {},
		config: config,
		artifact: document.artifact,
	}) as _Subscription['input']

	// the websocket connection only exists on the client
	onMount(() => {
		// we need to make sure that the user provided a socket connection
		if (!env.socket) {
			throw new Error(
				'The current environment is not configured to handle subscriptions. Make sure you ' +
					'passed a client to its constructor.'
			)
		}

		// start listening for updates from the server
		unsubscribe = env.socket.subscribe(
			{
				query: text,
				variables: marshaledVariables,
			},
			{
				next({ data, errors }) {
					// make sure there were no errors
					if (errors) {
						throw errors
					}

					// if we got a result
					if (data) {
						// update the cache with the result
						cache.write({
							selection,
							data,
							variables: marshaledVariables,
						})

						// update the local store
						store.set(unmarshalSelection(config, artifact.selection, data))
					}
				},
				error(data: _Subscription['result']) {},
				complete() {},
			}
		)
	})

	onDestroy(() => {
		// if we have a subscription going
		if (unsubscribe) {
			unsubscribe()
		}
	})

	return { data: { subscribe: store.subscribe } }
}
