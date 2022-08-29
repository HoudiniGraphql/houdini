import type { LoadEvent, RequestEvent } from '@sveltejs/kit'
import { get, Readable, Writable, writable } from 'svelte/store'

import { clientStarted, isBrowser, error, getPageData } from '../adapter'
import cache from '../cache'
import type { ConfigFile, QueryArtifact, Session } from '../lib'
import { deepEquals } from '../lib/deepEquals'
import * as log from '../lib/log'
import { fetchQuery } from '../lib/network'
import { marshalInputs, unmarshalSelection } from '../lib/scalars'
import {
	CachePolicy,
	DataSource,
	GraphQLObject,
	FetchContext,
	SubscriptionSpec,
	CompiledQueryKind,
} from '../lib/types'
import { BaseStore } from './store'

export class QueryStore<_Data extends GraphQLObject, _Input, _ExtraFields = {}> extends BaseStore {
	// the underlying artifact
	artifact: QueryArtifact

	// wether the store requires variables for input
	variables: boolean

	// identify it as a query store
	kind = CompiledQueryKind

	// at its core, a query store is a writable store with extra methods{
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
		// set the cache's config
		cache.setConfig(config)

		// validate and prepare the request context for the current environment (client vs server)
		const { policy, params, context } = fetchParams(this.artifact, this.storeName, args)

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
This will result in duplicate queries. If you are trying to ensure there is always a good value, please a CachePolicy instead.
If this is leftovers from old versions of houdini, you can safely remove this \`${this.storeName}\`.fetch() from your component.
`)

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

		// we might not want to wait for the fetch to resolve
		const fakeAwait = clientStarted && isBrowser && !params?.blocking

		this.setFetching(true)

		// perform the network request
		const request = this.fetchAndCache({
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
		})
		if (params.then) {
			// eslint-disable-next-line promise/no-nesting
			request.then((val) => params.then?.(val.result.data))
		}

		// if the await isn't fake, await it
		if (!fakeAwait) {
			await request
		}

		// the store will have been updated already since we waited for the response
		return get(this.store)
	}

	get name() {
		return this.artifact.name
	}

	protected async currentVariables() {
		return get(this.store).variables
	}

	subscribe(
		...args: Parameters<Readable<QueryResult<_Data, _Input, _ExtraFields>>['subscribe']>
	) {
		const bubbleUp = this.store.subscribe(...args)

		// we have a new subscriber
		this.subscriberCount = (this.subscriberCount ?? 0) + 1

		// Handle unsubscribe
		return () => {
			// we lost a subscriber
			this.subscriberCount--

			// don't clear the store state on the server (breaks SSR)
			// or when there is still an active subscriber
			if (this.subscriberCount <= 0) {
				// clean up any cache subscriptions
				if (isBrowser && this.subscriptionSpec) {
					cache.unsubscribe(this.subscriptionSpec, this.lastVariables || {})
				}

				// clear the variable counter
				this.lastVariables = null
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
	}) {
		const request = await fetchQuery<_Data, _Input>({
			...context,
			config,
			artifact,
			variables,
			cached,
			policy,
			context,
		})
		const { result, source, partial } = request

		// we're done
		setLoadPending(false)

		if (result.data && source !== DataSource.Cache) {
			// update the cache with the data that we just ran into
			cache.write({
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
				isFetching: false,
				partial: false,
				data: unmarshaled as _Data,
				source,
				variables,
			}))

			// don't go any further
			if (!config.quietQueryErrors) {
				throw error(500, result.errors.map((error) => error.message).join('. ') + '.')
			}
		} else {
			store.set({
				data: (unmarshaled || {}) as _Data,
				variables: variables || ({} as _Input),
				errors: null,
				isFetching: false,
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

		// track the newVariables
		this.lastVariables = newVariables
	}

	protected setFetching(isFetching: boolean) {
		this.store?.update((s) => ({ ...s, isFetching }))
	}

	private get initialState(): QueryResult<_Data, _Input> & _ExtraFields {
		return {
			data: null,
			errors: null,
			isFetching: false,
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

export function fetchParams<_Data extends GraphQLObject, _Input>(
	artifact: QueryArtifact,
	storeName: string,
	params?: QueryStoreFetchParams<_Data, _Input>
): {
	context: FetchContext
	policy: CachePolicy
	params: QueryStoreFetchParams<_Data, _Input>
} {
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

	// we need to figure out the right session source
	let session: Session = {}
	if (isBrowser) {
		session = getPageData()
	} else if (
		params &&
		'event' in params &&
		params.event &&
		'locals' in params.event &&
		params.event.locals
	) {
		session = params.event.locals
	}

	return {
		context: {
			fetch: fetchFn,
			metadata: params?.metadata ?? {},
			session,
		},
		policy,
		params: params ?? {},
	}
}

const contextError = (storeName: string) => `
	${log.red(`Missing event args in load function`)}.

	Three options:
	${log.cyan('1/ Prefetching & SSR')}
	<script context="module" lang="ts">
		import type { LoadEvent } from '@sveltejs/kit';

		export async function load(${log.yellow('event')}: LoadEvent) {
			const variables = { ... };
			await ${log.cyan(storeName)}.fetch({ ${log.yellow('event')}, variables });

			return { props: { variables } };
		}
	</script>

	<script lang="ts">
		import { type ${log.cyan(storeName)}$input } from '$houdini'
		export let variables: ${log.cyan(storeName)}$input;

		$: browser && ${log.cyan(storeName)}.fetch({ variables });
	</script>

	${log.cyan('2/ Client only')}
	<script lang="ts">
		$: browser && ${log.cyan(storeName)}.fetch({ variables: { ... } });
	</script>

	${log.cyan('3/ Endpoint')}
	import { ${log.cyan(storeName)} } from '$houdini';

	export async function get(event) {
		return {
			props: {
				data: await  ${log.cyan(storeName)}.fetch({ event })
			}
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
	 * A function to call after the fetch happens (wether fake or not)
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
> & {}

export type QueryStoreFetchParams<_Data extends GraphQLObject, _Input> =
	| QueryStoreLoadParams<_Data, _Input>
	| ClientFetchParams<_Data, _Input>

export type QueryStoreLoadParams<_Data extends GraphQLObject, _Input> =
	| LoadEventFetchParams<_Data, _Input>
	| RequestEventFetchParams<_Data, _Input>

export type QueryResult<_Data, _Input, _Extra = {}> = {
	data: _Data | null
	errors: { message: string }[] | null
	isFetching: boolean
	partial: boolean
	source: DataSource | null
	variables: _Input
} & _Extra
