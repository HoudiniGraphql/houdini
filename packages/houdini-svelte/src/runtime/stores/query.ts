import type { DocumentObserver } from '$houdini/runtime/client'
import type { FetchContext } from '$houdini/runtime/client/plugins/fetch'
import * as log from '$houdini/runtime/lib/log'
import type {
	QueryArtifact,
	GraphQLObject,
	HoudiniFetchContext,
	QueryResult,
} from '$houdini/runtime/lib/types'
// internals
import { CachePolicy, CompiledQueryKind } from '$houdini/runtime/lib/types'
import type { LoadEvent, RequestEvent } from '@sveltejs/kit'
import type { Readable } from 'svelte/store'
import { get } from 'svelte/store'

import type { PluginArtifactData } from '../../plugin/artifactData'
import { clientStarted, isBrowser } from '../adapter'
import { getClient } from '../client'
import { getSession } from '../session'

export class QueryStore<_Data extends GraphQLObject, _Input extends {}> {
	// the underlying artifact
	artifact: QueryArtifact

	// whether the store requires variables for input
	variables: boolean

	// identify it as a query store
	kind = CompiledQueryKind

	// at its core, a query store is a writable store with extra methods
	protected observer: DocumentObserver<_Data, _Input>

	// if there is a load in progress when the CSF triggers we need to stop it
	protected loadPending = false

	// in order to clear the store's value when unmounting, we need to track how many concurrent subscribers
	// we have. when this number is 0, we need to clear the store
	protected subscriberCount = 0

	// the string identifying the store
	protected storeName: string

	constructor({ artifact, storeName, variables }: StoreConfig<_Data, _Input, QueryArtifact>) {
		// set the initial state
		this.artifact = artifact

		// all queries should be with fetching: true by default (because auto fetching)
		// except for manual queries, which should be false, it will be manualy triggered
		const fetching =
			artifact.pluginsData?.['houdini-svelte'].isManualLoad === true ? false : true

		this.observer = getClient().observe({ artifact, fetching })
		this.storeName = storeName
		this.variables = variables
	}

	/**
	 * Fetch the data from the server
	 */
	fetch(params?: RequestEventFetchParams<_Data, _Input>): Promise<QueryResult<_Data, _Input>>
	fetch(params?: LoadEventFetchParams<_Data, _Input>): Promise<QueryResult<_Data, _Input>>
	fetch(params?: ClientFetchParams<_Data, _Input>): Promise<QueryResult<_Data, _Input>>
	fetch(params?: QueryStoreFetchParams<_Data, _Input>): Promise<QueryResult<_Data, _Input>>
	async fetch(args?: QueryStoreFetchParams<_Data, _Input>): Promise<QueryResult<_Data, _Input>> {
		// validate and prepare the request context for the current environment (client vs server)
		// make a shallow copy of the args so we don't mutate the arguments that the user hands us
		const { policy, params, context } = await fetchParams(this.artifact, this.storeName, args)

		// if we aren't on the browser but there's no event there's a big mistake
		if (!isBrowser && !(params && 'fetch' in params) && (!params || !('event' in params))) {
			// prettier-ignore
			log.error(contextError(this.storeName))

			throw new Error('Error, check above logs for help.')
		}

		// identify if this is a CSF or load
		const isLoadFetch = Boolean('event' in params && params.event)
		const isComponentFetch = !isLoadFetch

		// if there is a pending load, don't do anything
		if (this.loadPending && isComponentFetch) {
			log.error(`⚠️ Encountered fetch from your component while ${this.storeName}.load was running.
This will result in duplicate queries. If you are trying to ensure there is always a good value, please a CachePolicy instead.`)

			return get(this.observer)
		}

		// a component fetch is _always_ blocking
		if (isComponentFetch) {
			params.blocking = true
		}

		// the fetch is happening in a load
		if (isLoadFetch) {
			this.loadPending = true
		}

		// we might not want to actually wait for the fetch to resolve
		const fakeAwait = clientStarted && isBrowser && !params?.blocking

		// if a) the cache does not have the network only policy,
		// AND b) we are in a fakeAwait scenario (in a real await,
		// we will wait for the real fetch to happen anyway and fill the store)
		// then, we are safe to try to load it from the cache before we worry about
		// performing a network request. This makes sure the cache gets a cached
		// value during client side navigation (fake awaits)
		if (policy !== CachePolicy.NetworkOnly && fakeAwait) {
			await this.observer.send({
				fetch: context.fetch,
				variables: params.variables,
				metadata: params.metadata,
				session: context.session,
				policy: CachePolicy.CacheOnly,
			})
		}

		// if the query is a live query, we don't really care about network policies any more
		// since CacheOrNetwork behaves the same as CacheAndNetwork
		const request = this.observer.send({
			fetch: context.fetch,
			variables: params.variables,
			metadata: params.metadata,
			session: context.session,
			policy: policy,
			stuff: {},
		})

		// if we have to track when the fetch is done,
		request
			.then((val) => {
				this.loadPending = false
				params.then?.(val.data)
			})
			.catch(() => {})
		if (!fakeAwait) {
			await request
		}

		// the store will have been updated already since we waited for the response
		return get(this.observer)
	}

	get name() {
		return this.artifact.name
	}

	subscribe(...args: Parameters<Readable<QueryResult<_Data, _Input>>['subscribe']>) {
		const bubbleUp = this.observer.subscribe(...args)

		// make sure that the store is always listening to the cache (on the browser)
		if (isBrowser && this.subscriberCount === 0) {
			this.observer.send({
				setup: true,
				variables: get(this.observer).variables,
			})
		}

		// we have a new subscriber
		this.subscriberCount = (this.subscriberCount ?? 0) + 1

		// Handle unsubscribe
		return () => {
			// we lost a subscriber
			this.subscriberCount--

			// don't clear the store state on the server (breaks SSR)
			// or when there is still an active subscriber
			if (this.subscriberCount <= 0) {
				// we're done
				bubbleUp()
			}
		}
	}
}

// the parameters we will be passed from the generator
export type StoreConfig<_Data extends GraphQLObject, _Input, _Artifact> = {
	artifact: _Artifact & { pluginsData: { 'houdini-svelte': PluginArtifactData } }
	storeName: string
	variables: boolean
}

export async function fetchParams<_Data extends GraphQLObject, _Input>(
	artifact: QueryArtifact,
	storeName: string,
	params?: QueryStoreFetchParams<_Data, _Input>
): Promise<{
	context: FetchContext
	policy: CachePolicy
	params: QueryStoreFetchParams<_Data, _Input>
}> {
	// figure out the right policy
	let policy = params?.policy
	if (!policy) {
		// use the artifact policy as the default, otherwise prefer the cache over the network
		policy = artifact.policy ?? CachePolicy.CacheOrNetwork
	}

	// figure out the right fetch to use
	let fetchFn: LoadEvent['fetch'] | null = null

	if (params) {
		if ('fetch' in params && params.fetch) {
			fetchFn = params.fetch
		} else if ('event' in params && params.event && 'fetch' in params.event) {
			fetchFn = params.event.fetch
		}
	}

	// if we still don't have a fetch function, use the global one (node and browsers both have fetch)
	if (!fetchFn) {
		fetchFn = globalThis.fetch.bind(globalThis)
	}

	let session: any = undefined
	// cannot re-use the variable from above
	// we need to check for ourselves to satisfy typescript
	if (params && 'event' in params && params.event) {
		session = await getSession(params.event)
	} else if (isBrowser) {
		session = await getSession()
	} else {
		log.error(contextError(storeName))
		throw new Error('Error, check above logs for help.')
	}

	return {
		context: {
			fetch: fetchFn!,
			metadata: params?.metadata ?? {},
			session,
		},
		policy,
		params: params ?? {},
	}
}

const contextError = (storeName: string) => `
	${log.red(`Missing event args in load function`)}.

Please remember to pass event to fetch like so:

import type { LoadEvent } from '@sveltejs/kit';

export async function load(${log.yellow('event')}: LoadEvent) {
	return {
		...load_${storeName}({ ${log.yellow('event')}, variables: { ... } })
	};
}
`

type FetchGlobalParams<_Data extends GraphQLObject, _Input> = {
	variables?: _Input

	/**
	 * The policy to use when performing the fetch. If set to CachePolicy.NetworkOnly,
	 * a request will always be sent, even if the variables are the same as the last call
	 * to fetch.
	 */
	policy?: CachePolicy

	/**
	 * An object that will be passed to the fetch function.
	 * You can do what you want with it!
	 */
	// @ts-ignore
	metadata?: App.Metadata

	/**
	 * Set to true if you want the promise to pause while it's resolving.
	 * Only enable this if you know what you are doing. This will cause route
	 * transitions to pause while loading data.
	 */
	blocking?: boolean

	/**
	 * A function to call after the fetch happens (whether fake or not)
	 */
	then?: (val: _Data | null) => void | Promise<void>
}

export type LoadEventFetchParams<_Data extends GraphQLObject, _Input> = FetchGlobalParams<
	_Data,
	_Input
> & {
	/**
	 * Directly the `even` param coming from the `load` function
	 */
	event?: LoadEvent
}

export type RequestEventFetchParams<_Data extends GraphQLObject, _Input> = FetchGlobalParams<
	_Data,
	_Input
> & {
	/**
	 * A RequestEvent should be provided when the store is being used in an endpoint.
	 * When this happens, fetch also needs to be provided
	 */
	event?: RequestEvent
	/**
	 * The fetch function to use when using this store in an endpoint.
	 */
	fetch?: LoadEvent['fetch']
}

export type ClientFetchParams<_Data extends GraphQLObject, _Input> = FetchGlobalParams<
	_Data,
	_Input
> & {
	/**
	 * An object containing all of the current info necessary for a
	 * client-side fetch. Must be called in component initialization with
	 * something like this: `const context = getHoudiniFetchContext()`
	 */
	context?: HoudiniFetchContext
}

export type QueryStoreFetchParams<_Data extends GraphQLObject, _Input> =
	| QueryStoreLoadParams<_Data, _Input>
	| ClientFetchParams<_Data, _Input>

export type QueryStoreLoadParams<_Data extends GraphQLObject, _Input> =
	| LoadEventFetchParams<_Data, _Input>
	| RequestEventFetchParams<_Data, _Input>
