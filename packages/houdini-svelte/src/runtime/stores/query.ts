import { getCache } from '$houdini/runtime'
import type { ConfigFile } from '$houdini/runtime/lib/config'
import { deepEquals } from '$houdini/runtime/lib/deepEquals'
import * as log from '$houdini/runtime/lib/log'
import { FetchContext, fetchQuery } from '$houdini/runtime/lib/network'
import { marshalInputs, unmarshalSelection } from '$houdini/runtime/lib/scalars'
import type { QueryArtifact } from '$houdini/runtime/lib/types'
// internals
import {
	CachePolicy,
	CompiledQueryKind,
	DataSource,
	GraphQLObject,
	HoudiniFetchContext,
	QueryResult,
	SubscriptionSpec,
} from '$houdini/runtime/lib/types'
import type { LoadEvent, RequestEvent } from '@sveltejs/kit'
import { get, Readable, Writable, writable } from 'svelte/store'

import { clientStarted, error, isBrowser } from '../adapter'
import { getCurrentClient } from '../network'
import { getSession } from '../session'
import { BaseStore } from './store'

type FetchValue<_Data extends GraphQLObject, _Input extends {}> = Awaited<
	ReturnType<QueryStore<_Data, _Input>['fetchAndCache']>
>

export class QueryStore<
	_Data extends GraphQLObject,
	_Input extends {},
	_ExtraFields = {}
> extends BaseStore {
	// the underlying artifact
	artifact: QueryArtifact

	// whether the store requires variables for input
	variables: boolean

	// identify it as a query store
	kind = CompiledQueryKind

	// at its core, a query store is a writable store with extra methods
	protected store: Writable<StoreState<_Data, _Input, _ExtraFields>>

	// we will be reading and write the last known variables often, avoid frequent gets and updates
	protected lastVariables: _Input | null = null

	// track the subscription's existence to refresh and unsubscribe when unmounting
	protected subscriptionSpec: SubscriptionSpec | null = null

	// if there is a load in progress when the CSF triggers we need to stop it
	protected loadPending = false

	// in order to clear the store's value when unmounting, we need to track how many concurrent subscribers
	// we have. when this number is 0, we need to clear the store
	protected subscriberCount = 0

	// the string identifying the store
	protected storeName: string

	protected setFetching(fetching: boolean) {
		this.store?.update((s) => ({ ...s, fetching }))
	}

	protected async currentVariables() {
		return get(this.store).variables
	}

	onUnsubscribe: null | (() => void) = null

	constructor({ artifact, storeName, variables }: StoreConfig<_Data, _Input, QueryArtifact>) {
		super()

		// set the initial state
		this.store = writable(this.initialState)
		this.artifact = artifact
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
		const config = await this.getConfig()

		// validate and prepare the request context for the current environment (client vs server)
		// make a shallow copy of the args so we don't mutate the arguments that the user hands us
		const { policy, params, context } = await fetchParams(this.artifact, this.storeName, {
			...args,
		})

		// identify if this is a CSF or load
		const isLoadFetch = Boolean('event' in params && params.event)
		const isComponentFetch = !isLoadFetch

		// compute the variables we need to use for the query
		const input = ((await marshalInputs({
			artifact: this.artifact,
			input: params?.variables,
		})) || {}) as _Input
		const newVariables = {
			...this.lastVariables,
			...input,
		}

		// check if the variables are different from the last time we saw them
		let variableChange = !deepEquals(this.lastVariables, newVariables)

		// if we are loading on the client and the variables _are_ different, we have to
		// update the subscribers. do that before the fetch so we don't accidentally
		// cause the new data to trigger the old subscription after the store has been
		// update with fetchAndCache
		if (variableChange && isBrowser) {
			this.refreshSubscription(newVariables)
			this.store.update((s) => ({ ...s, variables: newVariables }))
		}

		// if there is a pending load, don't do anything
		if (this.loadPending && isComponentFetch) {
			log.error(`⚠️ Encountered fetch from your component while ${this.storeName}.load was running.
This will result in duplicate queries. If you are trying to ensure there is always a good value, please a CachePolicy instead.`)

			return get(this.store)
		}

		// a component fetch is _always_ blocking
		if (isComponentFetch) {
			params.blocking = true
		}

		// the fetch is happening in a load
		if (isLoadFetch) {
			this.loadPending = true
		}

		// its time to fetch the query, build up the necessary arguments
		const fetchArgs: Parameters<QueryStore<_Data, _Input>['fetchAndCache']>[0] = {
			config,
			context,
			artifact: this.artifact,
			variables: newVariables,
			store: this.store,
			cached: policy !== CachePolicy.NetworkOnly,
			setLoadPending: (val) => {
				this.loadPending = val
				this.setFetching(val)
			},
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
			const cachedStore = await this.fetchAndCache({
				...fetchArgs,
				rawCacheOnlyResult: true,
			})
			if (cachedStore && cachedStore?.result.data) {
				// update only what matters at this stage (data & fetching),
				// not all the store. The complete store will be filled later.
				this.store.update((s) => ({
					...s,
					data: cachedStore?.result.data,
					fetching: false,
				}))
			}
		}

		// if the query is a live query, we don't really care about network policies any more
		// since CacheOrNetwork behaves the same as CacheAndNetwork
		const request =
			this.artifact.live && isBrowser
				? this.#liveQuery(fetchArgs)
				: this.fetchAndCache(fetchArgs)

		// if we have to track when the fetch is done,
		if (params.then) {
			request.then((val) => params.then?.(val.result.data))
		}

		if (!fakeAwait) {
			await request
		}

		// the store will have been updated already since we waited for the response
		return get(this.store)
	}

	get name() {
		return this.artifact.name
	}

	// the live query fetch resolves with the first value and starts listening for new events
	// from the server
	async #liveQuery(
		args: Parameters<QueryStore<_Data, _Input>['fetchAndCache']>[0]
	): Promise<FetchValue<_Data, _Input>> {
		console.log('setting up live query')
		// grab the current client
		const client = await getCurrentClient()

		// make sure there's a live query handler
		const handler = client.live
		if (!handler) {
			throw new Error('Looks like this client is not set up for live queries')
		}

		// we're only going to resolve the promise once
		let resolved = false

		return await new Promise((resolve) => {
			this.onUnsubscribe = handler({
				text: args.artifact.raw,
				variables: args.variables,
				hash: args.artifact.hash,
				onMessage(value) {
					console.log(value)
					// if we haven't resolved the promise yet, resolve it with the value
					if (!resolved) {
						resolve({
							result: { data: null, errors: null },
							partial: false,
							source: DataSource.Network,
						})
					}
				},
			})
		})
	}

	subscribe(
		...args: Parameters<Readable<QueryResult<_Data, _Input, _ExtraFields>>['subscribe']>
	) {
		const bubbleUp = this.store.subscribe(...args)

		// we have a new subscriber
		this.subscriberCount = (this.subscriberCount ?? 0) + 1

		// make sure that the store is always listening to the cache (on the browser)
		if (isBrowser && !this.subscriptionSpec) {
			this.refreshSubscription(this.lastVariables ?? ({} as _Input))
		}

		// Handle unsubscribe
		return () => {
			// we lost a subscriber
			this.subscriberCount--

			// don't clear the store state on the server (breaks SSR)
			// or when there is still an active subscriber
			if (this.subscriberCount <= 0) {
				// clean up any cache subscriptions
				if (isBrowser && this.subscriptionSpec) {
					getCache().unsubscribe(this.subscriptionSpec, this.lastVariables || {})
				}

				// clear the active subscription
				this.subscriptionSpec = null
			}

			// we're done
			bubbleUp()
		}
	}

	//// Internal methods

	private async fetchAndCache({
		config,
		artifact,
		variables,
		store,
		cached,
		ignoreFollowup,
		setLoadPending,
		policy,
		context,
		rawCacheOnlyResult = false,
	}: {
		config: ConfigFile
		artifact: QueryArtifact
		variables: _Input
		store: Writable<QueryResult<_Data, _Input>>
		cached: boolean
		ignoreFollowup?: boolean
		setLoadPending: (pending: boolean) => void
		policy?: CachePolicy
		context: FetchContext
		rawCacheOnlyResult?: boolean
	}) {
		const request = await fetchQuery<_Data, _Input>({
			...context,
			client: await getCurrentClient(),
			setFetching: (val) => this.setFetching(val),
			artifact,
			variables,
			cached,
			policy: rawCacheOnlyResult ? CachePolicy.CacheOnly : policy,
			context,
		})
		const { result, source, partial } = request

		// if we want only the raw CacheOnly result,
		// return it directly
		if (rawCacheOnlyResult) {
			return request
		}

		// we're done
		setLoadPending(false)

		if (result.data && source !== DataSource.Cache) {
			// update the cache with the data that we just ran into
			getCache().write({
				selection: artifact.selection,
				data: result.data,
				variables: variables || {},
			})
		}

		// unmarshal the result into complex scalars if its a response from the server
		const unmarshaled =
			source === DataSource.Cache
				? result.data
				: unmarshalSelection(config, artifact.selection, result.data)

		// since we know we're not prefetching, we need to update the store with any errors
		if (result.errors && result.errors.length > 0) {
			store.update((s) => ({
				...s,
				errors: result.errors,
				fetching: false,
				partial: false,
				data: unmarshaled as _Data,
				source,
				variables,
			}))

			// don't go any further
			if (
				// @ts-ignore
				!config.plugins?.['houdini-svelte']?.quietQueryErrors
			) {
				throw error(500, result.errors.map((error) => error.message).join('. ') + '.')
			}
		} else {
			store.set({
				data: (unmarshaled || {}) as _Data,
				variables: variables || ({} as _Input),
				errors: null,
				fetching: false,
				partial: request.partial,
				source: request.source,
			})
		}

		if (!ignoreFollowup) {
			// if the data was loaded from a cached value, and the document cache policy wants a
			// network request to be sent after the data was loaded, load the data
			if (source === DataSource.Cache && artifact.policy === CachePolicy.CacheAndNetwork) {
				this.fetchAndCache({
					config,
					context,
					artifact,
					variables,
					store,
					cached: false,
					ignoreFollowup: true,
					setLoadPending,
					policy,
				})
			}
			// if we have a partial result and we can load the rest of the data
			// from the network, send the request
			if (partial && artifact.policy === CachePolicy.CacheOrNetwork) {
				this.fetchAndCache({
					config,
					context,
					artifact,
					variables,
					store,
					cached: false,
					ignoreFollowup: true,
					setLoadPending,
					policy,
				})
			}
		}

		return request
	}

	// a method to update the store's cache subscriptions
	private refreshSubscription(newVariables: _Input) {
		const cache = getCache()
		// if the variables changed we need to unsubscribe from the old fields and
		// listen to the new ones
		if (this.subscriptionSpec) {
			cache.unsubscribe(this.subscriptionSpec, this.lastVariables || {})
		}

		// subscribe to cache updates
		this.subscriptionSpec = {
			rootType: this.artifact.rootType,
			selection: this.artifact.selection,
			variables: () => newVariables,
			set: (newValue) => this.store.update((s) => ({ ...s, data: newValue })),
		}

		// make sure we subscribe to the new values
		cache.subscribe(this.subscriptionSpec, newVariables)

		// if we have a live query to unsubscribe
		if (this.onUnsubscribe) {
			console.log('on subscribe')
			this.onUnsubscribe()
		}

		// track the newVariables
		this.lastVariables = newVariables
	}

	private get initialState(): QueryResult<_Data, _Input> & _ExtraFields {
		return {
			data: null,
			errors: null,
			fetching: true,
			partial: false,
			source: null,
			variables: {} as _Input,
			...this.extraFields(),
		}
	}

	extraFields(): _ExtraFields {
		return {} as _ExtraFields
	}
}

// the parameters we will be passed from the generator
export type StoreConfig<_Data extends GraphQLObject, _Input, _Artifact> = {
	artifact: _Artifact
	storeName: string
	variables: boolean
}

type StoreState<_Data, _Input, _Extra = {}> = QueryResult<_Data, _Input> & _Extra

export async function fetchParams<_Data extends GraphQLObject, _Input>(
	artifact: QueryArtifact,
	storeName: string,
	params?: QueryStoreFetchParams<_Data, _Input>
): Promise<{
	context: FetchContext
	policy: CachePolicy
	params: QueryStoreFetchParams<_Data, _Input>
}> {
	// if we aren't on the browser but there's no event there's a big mistake
	if (!isBrowser && !(params && 'fetch' in params) && (!params || !('event' in params))) {
		// prettier-ignore
		log.error(contextError(storeName))

		throw new Error('Error, check above logs for help.')
	}
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
