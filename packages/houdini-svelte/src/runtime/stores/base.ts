import { DocumentStore, type ObserveParams } from '$houdini/runtime/client'
import type {
	GraphQLObject,
	DocumentArtifact,
	QueryResult,
	GraphQLVariables,
} from '$houdini/runtime/lib/types'
import { get } from 'svelte/store'
import type { Readable } from 'svelte/store'

import { isBrowser } from '../adapter'
import { getClient } from '../client'

export class BaseStore<
	_Data extends GraphQLObject,
	_Input extends GraphQLVariables,
	_Artifact extends DocumentArtifact = DocumentArtifact
> {
	// the underlying data
	#params: ObserveParams<_Data, _Artifact, _Input> & { initialize?: boolean }
	get artifact() {
		return this.#params.artifact
	}
	get name() {
		return this.artifact.name
	}

	// loading the client is an asynchronous process so we need something for users to subscribe
	// to while we load the client. this means we need 2 different document stores, one that
	// the user subscribes to and one that we actually get results from.
	#store: DocumentStore<_Data, _Input>
	#unsubscribe: (() => void) | null = null

	constructor(params: ObserveParams<_Data, _Artifact, _Input> & { initialize?: boolean }) {
		// if we weren't given an initialization state, set it to true
		if (typeof params.initialize === 'undefined') {
			params.initialize = true
		}

		// we pass null here so that the store is a zombie - we will never
		// send a request until the client has loaded
		this.#store = new DocumentStore({
			artifact: params.artifact,
			client: null,
			fetching: params.fetching,
			initialValue: params.initialValue,
		})

		this.#params = params
	}

	#observer: DocumentStore<_Data, _Input> | null = null
	get observer(): DocumentStore<_Data, _Input> {
		if (this.#observer) {
			return this.#observer
		}

		this.#observer = getClient().observe<_Data, _Input>(this.#params)

		return this.#observer
	}

	subscribe(...args: Parameters<Readable<QueryResult<_Data, _Input>>['subscribe']>) {
		const bubbleUp = this.#store.subscribe(...args)

		// make sure that the store is always listening to the cache (on the browser)
		if (isBrowser && (this.#subscriberCount === 0 || !this.#unsubscribe)) {
			// make sure the query is listening
			this.setup()
		}

		// we have a new subscriber
		this.#subscriberCount = (this.#subscriberCount ?? 0) + 1

		// Handle unsubscribe
		return () => {
			// we lost a subscriber
			this.#subscriberCount--

			// don't clear the store state on the server (breaks SSR)
			// or when there is still an active subscriber
			if (this.#subscriberCount <= 0) {
				// unsubscribe from the actual document store
				this.#unsubscribe?.()
				this.#unsubscribe = null

				// unsubscribe from the local store
				bubbleUp()
			}
		}
	}

	// in order to clear the store's value when unmounting, we need to track how many concurrent subscribers
	// we have. when this number is 0, we need to clear the store
	#subscriberCount = 0

	setup(init: boolean = true) {
    if (this.#unsubscribe) {
      return
    }

    this.#unsubscribe = this.observer.subscribe((value) => {
      this.#store.set(value)
    })

    // only initialize when told to
    if (init && this.#params.initialize) {
      return this.observer.send({
        setup: true,
        variables: get(this.observer).variables,
      })
    }
	}
}
