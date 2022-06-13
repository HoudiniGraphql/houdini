// externals
import { logCyan, logRed, logYellow } from '@kitql/helper'
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
	let tracking: {} | null = null

	let latestSource: DataSource | null = null
	let latestPartial: boolean | null = false

	// Perform the actual load
	async function load(
		context: FetchContext,
		params: QueryStoreParams<_Input>,
		background: boolean
	) {
		update((c) => {
			return { ...c, isFetching: true }
		})

		// params management
		params = params ?? {}

		// If no policy specified => artifact.policy, if there is nothing go to CacheOrNetwork
		if (!params.policy) {
			params.policy = artifact.policy ?? CachePolicy.CacheOrNetwork
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

		update((s) => ({
			...s,
			isFetching: false,
		}))

		// keep the trackers up to date
		latestSource = source
		latestPartial = partial

		if (result.errors && result.errors.length > 0) {
			update((s) => ({
				...s,
				errors: result.errors,
				isFetching: false,
				partial: false,
				data: result.data as _Data,
				source,
				variables: newVariables,
			}))
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
					update((s) => ({ ...s, data }))
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

		if (!isBrowser || JSON.stringify(newVariables) === JSON.stringify(tracking)) {
			set(storeValue)
		}

		return storeValue
	}

	async function fetchData(params?: QueryStoreParams<_Input>) {
		params = params ?? {}
		if (!params.context) {
			params.context = {} as HoudiniFetchContext
		}

		// if fetch is happening on the server, it must get a load event
		if (!isBrowser && !params.event) {
			// prettier-ignore
			console.error(`${logRed(`Missing load event in server-side ${storeName}.fetch`)}. 
  I think you forgot to provide ${logYellow('event')} to ${storeName} fetch function. 
  You can get this value from the load function like:

  <script context="module" lang="ts">
    import type { LoadEvent } from '@sveltejs/kit';

    export async function load(${logYellow('event')}: LoadEvent) {
      await ${logCyan(storeName)}.fetch({ ${logYellow('event')}, variables: { ... } });
      return {};
    }
  </script> 
`);

			throw new Error('Error, check above logs for help.')
		}

		// if we have event, it's safe to assume this is inside of a load function
		if (params.event) {
			// if we aren't tracking anything yet, we need to track the first thing
			// we are loaded with
			if (!tracking) {
				tracking = params.variables || {}
			}

			// we're in a `load` function, use the event params
			const loadPromise = load(params.event, params, true)

			// return the result if the client isn't ready or we
			// need to block with the request
			if (!clientStarted || params.blocking) {
				return await loadPromise
			}
		}
		// the fetch is executing on the client,
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
				false
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

				parentUnsubscribe()
			}
		},

		fetch: fetchData,

		listen(toTrack: _Input) {
			// if the tracked variables hasn't changed, don't do anything
			if (JSON.stringify(toTrack) === JSON.stringify(tracking)) {
				return
			}

			const context = getHoudiniContext()

			// fetch the new data, update subscribers, etc.
			fetchData({ context, variables: toTrack })

			// we are now tracking the new set of variables
			tracking = toTrack
		},

		...extraMethods,
	}
}
