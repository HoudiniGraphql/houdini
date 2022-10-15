import { getCache } from '$houdini/runtime'
import { deepEquals } from '$houdini/runtime/lib/deepEquals'
import { marshalInputs, unmarshalSelection } from '$houdini/runtime/lib/scalars'
import { CompiledSubscriptionKind, SubscriptionArtifact } from '$houdini/runtime/lib/types'
import { writable, Writable } from 'svelte/store'

import { isBrowser } from '../adapter'
import { getCurrentClient } from '../network'
import { BaseStore } from './store'

export class SubscriptionStore<_Data, _Input extends {}> extends BaseStore {
	artifact: SubscriptionArtifact
	kind = CompiledSubscriptionKind

	private store: Writable<_Data | null>
	// the function to call to unregister the subscription
	private clearSubscription = () => {}
	// listen might be called multiple times while mounted
	private lastVariables: _Input | null = null

	constructor({ artifact }: { artifact: SubscriptionArtifact }) {
		super()
		this.artifact = artifact
		this.store = writable(null)
	}

	subscribe(...args: Parameters<Writable<_Data | null>['subscribe']>) {
		return this.store?.subscribe(...args)
	}

	async listen(variables?: _Input) {
		// @ts-expect-error: typechecking cjs/esm interop is hard
		// pull the query text out of the compiled artifact
		const { raw: text, selection } = this.artifact.default || this.artifact

		// subscription.listen is a no-op on the server
		if (!isBrowser) {
			return
		}
		// pull out the current client
		const config = await this.getConfig()
		const env = await getCurrentClient()
		// we need to make sure that the user provided a socket connection
		if (!env.socket) {
			throw new Error(
				'The current Houdini Client is not configured to handle subscriptions. Make sure you ' +
					'passed a socketClient to HoudiniClient constructor.'
			)
		}

		// marshal the inputs into their raw values
		const marshaledVariables = (await marshalInputs({
			input: variables || {},
			artifact: this.artifact,
		})) as _Input

		// if the variables haven't changed, don't do anything
		if (deepEquals(this.lastVariables, marshaledVariables)) {
			return
		}

		// clear any existing subscription
		this.clearSubscription()

		// save the last set
		this.lastVariables = marshaledVariables

		// start listening for updates from the server
		this.clearSubscription = env.socket.subscribe(
			{
				query: text,
				variables: marshaledVariables,
			},
			{
				next: ({ data, errors }) => {
					// make sure there were no errors
					if (errors) {
						throw errors
					}

					// if we got a result
					if (data) {
						// update the cache with the result
						getCache().write({
							selection,
							data,
							variables: marshaledVariables,
						})

						// update the local store
						this.store.set(
							unmarshalSelection(config, this.artifact.selection, data) as _Data
						)
					}
				},
				error(data) {},
				complete() {},
			}
		)
	}

	unlisten() {
		this.clearSubscription()
		this.clearSubscription = () => {}
		this.lastVariables = null
	}
}
