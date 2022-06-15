// externals
import { logCyan, logRed, logYellow, stry } from '@kitql/helper'
import { onMount } from 'svelte'
import { Readable, writable } from 'svelte/store'
import { CachePolicy, DataSource, fetchQuery } from '..'
import { clientStarted, isBrowser } from '../adapter'
import cache from '../cache'
import {
	FetchContext,
	getHoudiniContext,
	HoudiniFetchContext,
	QueryResult,
	QueryStoreParams,
	SubscriptionSpec,
} from '../lib'
import { PaginatedHandlers, queryHandlers } from '../lib/pagination'
import { marshalInputs, unmarshalSelection } from '../lib/scalars'
import type { ConfigFile } from '../lib/types'
import { QueryArtifact } from '../lib/types'

function transformParam<_Input>(artifact: QueryArtifact, params?: QueryStoreParams<_Input>) {
	// params management
	params = params ?? {}

	if (!params.context) {
		params.context = {} as HoudiniFetchContext
	}

	// If no policy specified => artifact.policy, if there is nothing go to CacheOrNetwork
	if (!params.policy) {
		params.policy = artifact.policy ?? CachePolicy.CacheOrNetwork
	}

	return params
}

export function queryStore<_Data, _Input>({
	config,
	artifact,
	storeName,
	paginationMethods,
	paginated,
}: {
	config: ConfigFile
	artifact: QueryArtifact
	paginated: boolean
	storeName: string
	paginationMethods: { [key: string]: keyof PaginatedHandlers<_Data, _Input> }
}) {
	// the first prefetch
	let hasLoaded = false

	// build up the core query store data
	const { subscribe, set, update } = writable<QueryResult<_Data, _Input>>({
		data: null,
		errors: null,
		isFetching: false,
		partial: false,
		source: null,
		variables: null,
	})

	// Track subscriptions
	let subscriptionSpec: SubscriptionSpec | null = null

	// Current variables tracker
	let variables: {} = {}
	let tracking: {} | undefined | null = null

	let latestSource: DataSource | null = null
	let latestPartial: boolean | null = false

	// Perform the actual load
	async function load(
		context: FetchContext,
		params: QueryStoreParams<_Input>,
		background: boolean,
		withStoreSync: boolean
	) {
		if (!withStoreSync && !hasLoaded) {
			withStoreSync = true
			hasLoaded = true
		}

		if (withStoreSync) {
			update((c) => {
				return { ...c, isFetching: true }
			})
		}

		const newVariables = (marshalInputs({
			artifact,
			config,
			input: params.variables,
		}) || {}) as _Input

		// Todo: validate inputs before we query the api

		const { result, source, partial } = await fetchQuery({
			context,
			artifact,
			variables: newVariables || {},
			session: context.session,
			cached: params.policy !== CachePolicy.NetworkOnly,
		})

		if (withStoreSync) {
			update((s) => ({
				...s,
				isFetching: false,
			}))
		}

		// keep the trackers up to date
		latestSource = source
		latestPartial = partial

		if (result.errors && result.errors.length > 0) {
			if (withStoreSync) {
				update((s) => ({
					...s,
					errors: result.errors,
					isFetching: false,
					partial: false,
					data: result.data as _Data,
					source,
					variables: newVariables,
				}))
			}
			throw result.errors
		}

		// setup a subscription for new values from the cache

		if (isBrowser && !background) {
			const updated = JSON.stringify(variables) !== JSON.stringify(newVariables)

			// if the variables changed we need to unsubscribe from the old fields and
			// listen to the new ones
			if (updated && subscriptionSpec) {
				cache.unsubscribe(subscriptionSpec, variables || {})
			}

			// subscribe to cache updates
			subscriptionSpec = {
				rootType: artifact.rootType,
				selection: artifact.selection,
				variables: () => newVariables,
				set: (data) => {
					if (withStoreSync) {
						update((s) => ({ ...s, data }))
					}
				},
			}

			// make sure we subscribe to the new values
			cache.subscribe(subscriptionSpec, newVariables)
		}

		if (result.data) {
			// update the cache with the data that we just ran into
			cache.write({
				selection: artifact.selection,
				data: result.data,
				variables: newVariables,
			})
		}

		if (!background) {
			// update Current variables tracker
			variables = newVariables
		}

		// return the value to the caller
		const storeValue = {
			data: unmarshalSelection(config, artifact.selection, result.data)! as _Data,
			errors: null,
			isFetching: false,
			partial: partial,
			source: source,
			variables: newVariables,
		}

		if (withStoreSync) {
			set(storeValue)
		}

		return storeValue
	}

	async function fetchData(params: QueryStoreParams<_Input>) {
		params = transformParam(artifact, params)

		// if fetch is happening on the server, it must get a load event
		if (!isBrowser && !params.event) {
			// prettier-ignore
			console.error(`
	${logRed(`Missing event args in load function`)}. 

	Two options:
	${logCyan("1/ Prefetching & SSR")}
  <script context="module" lang="ts">
    import type { LoadEvent } from '@sveltejs/kit';

    export async function load(${logYellow('event')}: LoadEvent) {
			const variables = { ... };
      await ${logCyan(storeName)}.prefetch({ ${logYellow('event')}, variables });
      return { props: { variables } };
    }
  </script> 

	<script lang="ts">
		import { type ${logCyan(storeName)}$input } from '$houdini'
		export let variables: ${logCyan(storeName)}$input;
		
		$: browser && ${logCyan(storeName)}.fetch({ variables });
	</script> 

	${logCyan("2/ Client only")}
	<script lang="ts">
		$: browser && ${logCyan(storeName)}.fetch({ variables: { ... } });
	</script> 
`);

			throw new Error('Error, check above logs for help.')
		}

		// if we have event, it's safe to assume this is inside of a load function
		if (params.event) {
			// we're in a `load` function, use the event params
			const loadPromise = load(params.event, params, true, false)

			// return the result if the client isn't ready or we
			// need to block with the request
			if (!clientStarted || params.blocking) {
				return await loadPromise
			}
		}
		// if we don't have event, it's safe to assume this is outside of a load function
		else {
			// this is happening in the browser so we dont' have access to the
			// current load parameters
			const context: FetchContext = {
				fetch: window.fetch.bind(window),
				session: params.context?.session!,
				stuff: params.context?.stuff!,
			}

			return await load(
				context,
				{
					...params,
					variables: { ...variables, ...params.variables } as _Input,
				},
				false,
				true
			)
		}
	}

	// build up the methods we want to use
	let extraMethods: {} = {}
	if (paginated) {
		const handlers = queryHandlers({
			config,
			artifact,
			store: {
				subscribe,
				async prefetch(params) {
					return (await fetchData({
						...params,
						blocking: true,
					}))!
				},
				async fetch(params) {
					return (await fetchData({
						...params,
						blocking: true,
					}))!
				},
			},
			queryVariables: () => variables,
		})

		extraMethods = Object.fromEntries(
			Object.entries(paginationMethods).map(([key, value]) => [key, handlers[value]])
		)
	}

	return {
		subscribe: (...args: Parameters<Readable<QueryResult<_Data, _Input>>['subscribe']>) => {
			const parentUnsubscribe = subscribe(...args)

			const context = getHoudiniContext()
			onMount(() => {
				// we might have a followup request to fulfill the store's needs
				const loadContext = {
					fetch: window.fetch.bind(window),
					page: context.page,
					session: context.session,
					stuff: context.stuff,
				}

				// if the data was loaded from a cached value, and the document cache policy wants a
				// network request to be sent after the data was loaded, load the data
				if (
					latestSource === DataSource.Cache &&
					artifact.policy === CachePolicy.CacheAndNetwork
				) {
					// this will invoke pagination's refetch because of javascript's magic this binding
					fetchQuery({
						context: loadContext,
						artifact,
						variables: variables,
						session: context.session,
						cached: false,
					})
				}

				// if we have a partial result and we can load the rest of the data
				// from the network, send the request
				if (latestPartial && artifact.policy === CachePolicy.CacheOrNetwork) {
					fetchQuery({
						context: loadContext,
						artifact,
						variables: variables,
						session: context.session,
						cached: false,
					})
				}
			})

			// Handle unsubscribe
			return () => {
				if (subscriptionSpec) {
					cache.unsubscribe(subscriptionSpec, variables)
					subscriptionSpec = null
				}

				latestSource = null
				latestPartial = null
				hasLoaded = false

				parentUnsubscribe()
			}
		},

		prefetch: fetchData,

		fetch(params?: QueryStoreParams<_Input>) {
			params = transformParam(artifact, params)

			if (params.event) {
				// prettier-ignore
				console.error(`
	${logCyan(storeName)}.fetch({ ${logYellow('event')} }) ${logRed(`should never be used in the load function!`)}. 
	Please use ${logCyan(storeName)}.prefetch({ ${logYellow('event')} }) instead.`);

				throw new Error('Error, check above logs for help.')
			}

			if (params.policy === CachePolicy.NetworkOnly) {
				// We want to continue to load the data from the network anyway
			} else {
				// if the tracked variables hasn't changed, don't do anything
				if (stry(params?.variables) === stry(tracking)) {
					return
				}
			}

			// fetch the new data, update subscribers, etc.
			fetchData(params)

			// we are now tracking the new set of variables
			tracking = params?.variables
		},

		...extraMethods,
	}
}
