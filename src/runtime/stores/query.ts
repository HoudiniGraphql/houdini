// externals
import { logCyan, logRed, logYellow, stry } from '@kitql/helper'
import { get, Readable, Writable, writable } from 'svelte/store'
// internals
import { CachePolicy, DataSource, fetchQuery, QueryStore } from '..'
import { clientStarted, isBrowser } from '../adapter'
import cache from '../cache'
import {
	FetchContext,
	getHoudiniContext,
	QueryResult,
	QueryStoreFetchParams,
	SubscriptionSpec,
} from '../lib'
import { PaginatedHandlers, queryHandlers } from '../lib/pagination'
import { marshalInputs, unmarshalSelection } from '../lib/scalars'
import type { ConfigFile } from '../lib/types'
import { QueryArtifact } from '../lib/types'

// A query store has 3 different flows it has to deal with:
// - Server-Rendered Request:
//   - has to use a version of fetch appropriate for the server
//   - fetch the data in load() on the server and rendering to html
//   - fetch the data in load() on the client
//     - if the store was fetched with the same variables as the load, we don't want to do anything (unless forced)
//     - update the store value
//     - create/update subscriptions
//
// - Data fetched inside of a component body
//   - load only fires on client state
//   - populate the cache with data
//   - update the store value
//   - create/update subscriptions
//
// - Pre-Loading data for a new set of variables (for example, during a request created by sveltekit:prefetch)
//   - does not update the store's loading state
//   - populate the cache with data
//   - do not touch the cache subscriptions
//   - do not update the store value
//
// Questions:
// - how does the client side cache get populated with the initial data from the server-side render?
// - can we put something in the response as the raw data we can write?
//   - extra steps for store users but that's okay. they're writing their own loads, they are accepting the extra work.

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
}): QueryStore<_Data, _Input> {
	// at its core, a query store is a writable store with extra methods
	const store = writable<QueryResult<_Data, _Input>>({
		data: null,
		errors: null,
		isFetching: false,
		partial: false,
		source: null,
		variables: null,
	})
	const setFetching = (isFetching: boolean) => store.update((s) => ({ ...s, isFetching }))
	const getVariables = () => get(store).variables

	// Track subscriptions
	let subscriptionSpec: SubscriptionSpec | null = null

	// we will be reading and write the last known variables often, avoid frequent gets and updates
	let lastVariables: _Input = {} as _Input

	// a function to fetch data (the root of the behavior tree described above)
	async function fetch(
		params?: QueryStoreFetchParams<_Input>
	): Promise<QueryResult<_Data, _Input>> {
		// we need to tweak our logic when prefetch
		let isPrefetch = false
		// client and prefetch both happen on the browser
		if (isBrowser && params?.event) {
			// in order for there to be a prefetch, there has to be an event with an url that does not
			// point to the current one
			isPrefetch = window.location.href !== params.event.url.href
		}

		// prepare the request context
		const { context, policy } = fetchContext(artifact, storeName, params)

		// compute the variables we need to use for the query
		const newVariables = (marshalInputs({
			artifact,
			config,
			input: params?.variables,
		}) || {}) as _Input

		// if we're not prefetching, update the loading state
		if (!isPrefetch) {
			setFetching(true)
		}

		// in all cases, we need to perform the fetch with the new variables and cache the result
		const request = fetchAndCache<_Data, _Input>({
			context,
			artifact,
			variables: newVariables,
			store,
			updateStore: !isPrefetch,
			cached: policy !== CachePolicy.NetworkOnly,
		})

		// if we're not supposed to block, we're done
		if (clientStarted && params && !params.blocking) {
			return {
				data: null,
				errors: null,
				isFetching: false,
				partial: false,
				source: null,
				variables: newVariables,
			}
		}

		// otherwise we need to do something with the result
		const { result, source, partial } = await request

		// bundle the result into the right shape
		const storeValue = {
			data: unmarshalSelection(config, artifact.selection, result.data)! as _Data,
			errors: null,
			isFetching: false,
			partial: partial,
			source: source,
			variables: newVariables,
		}

		// if we're pre-fetching, we're done
		if (isPrefetch) {
			return storeValue
		}

		// before we do anything else, lets send the followup queries

		// if the data was loaded from a cached value, and the document cache policy wants a
		// network request to be sent after the data was loaded, load the data
		if (source === DataSource.Cache && artifact.policy === CachePolicy.CacheAndNetwork) {
			fetchAndCache<_Data, _Input>({
				context,
				artifact,
				variables: newVariables,
				store,
				cached: false,
				updateStore: true,
			})
		}

		// if we have a partial result and we can load the rest of the data
		// from the network, send the request
		if (partial && artifact.policy === CachePolicy.CacheOrNetwork) {
			fetchAndCache<_Data, _Input>({
				context,
				artifact,
				variables: newVariables,
				store,
				cached: false,
				updateStore: true,
			})
		}

		// all that's left is to make sure that our subscribers are up to date which only matters on the client
		if (isBrowser) {
			// figure out if the variables changed
			const updated = stry(lastVariables, 0) !== stry(newVariables, 0)

			// if the variables changed we need to unsubscribe from the old fields and
			// listen to the new ones
			if (updated && subscriptionSpec) {
				cache.unsubscribe(subscriptionSpec, lastVariables)
			}

			// subscribe to cache updates
			subscriptionSpec = {
				rootType: artifact.rootType,
				selection: artifact.selection,
				variables: () => newVariables,
				set: (data) => store.update((s) => ({ ...s, data })),
			}

			// make sure we subscribe to the new values
			cache.subscribe(subscriptionSpec, newVariables)
		}

		// we're done. update the various bits of state
		lastVariables = newVariables
		store.set(storeValue)
		return storeValue
	}

	// add the pagination methods to the store
	let extraMethods: {} = {}
	if (paginated) {
		const handlers = queryHandlers({
			config,
			artifact,
			store: {
				subscribe: store.subscribe,
				async fetch(params) {
					return (await fetch({
						...params,
						blocking: true,
					}))!
				},
			},
			queryVariables: getVariables,
		})

		extraMethods = Object.fromEntries(
			Object.entries(paginationMethods).map(([key, value]) => [key, handlers[value]])
		)
	}

	return {
		subscribe: (...args: Parameters<Readable<QueryResult<_Data, _Input>>['subscribe']>) => {
			const bubbleUp = store.subscribe(...args)

			// Handle unsubscribe
			return () => {
				if (subscriptionSpec) {
					cache.unsubscribe(subscriptionSpec, lastVariables)
				}
				bubbleUp()
			}
		},
		fetch,
		...extraMethods,
	}
}

function fetchContext<_Data, _Input>(
	artifact: QueryArtifact,
	storeName: string,
	params?: QueryStoreFetchParams<_Input>
): { context: FetchContext; policy: CachePolicy } {
	// if we aren't on the browser but there's no event there's a big mistake
	if (!isBrowser && !params?.event) {
		// prettier-ignore
		console.error(`
	${logRed(`Missing event args in load function`)}. 

	Two options:
	${logCyan("1/ Prefetching & SSR")}
  <script context="module" lang="ts">
    import type { LoadEvent } from '@sveltejs/kit';

    export async function load(${logYellow('event')}: LoadEvent) {
			const variables = { ... };
      await ${logCyan(storeName)}.fetch({ ${logYellow('event')}, variables });
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

	// figure out the right policy
	let policy = params?.policy
	if (params?.force) {
		policy = CachePolicy.NetworkOnly
	} else if (!policy) {
		// use the artifact policy as the default, otherwise prefer the cache over the network
		policy = artifact.policy ?? CachePolicy.CacheOrNetwork
	}

	// if there is an event (we are inside of a load), the event is a good enough context, otherwise
	// we have to build up a context appropriate for the client
	let context: FetchContext | undefined = params?.event
	if (!context) {
		const houdiniContext = params?.context || getHoudiniContext()
		context = {
			fetch: window.fetch.bind(window),
			session: houdiniContext.session(),
			stuff: houdiniContext.stuff || {},
		}
	}
	return { context, policy }
}

async function fetchAndCache<_Data, _Input>({
	context,
	artifact,
	variables,
	store,
	updateStore,
	cached,
}: {
	context: FetchContext
	artifact: QueryArtifact
	variables: _Input
	store: Writable<QueryResult<_Data, _Input>>
	updateStore: boolean
	cached: boolean
}) {
	const request = await fetchQuery({
		context,
		artifact,
		variables,
		cached,
	})
	const { result, source } = request

	if (result.data) {
		// update the cache with the data that we just ran into
		cache.write({
			selection: artifact.selection,
			data: result.data,
			variables: variables || {},
		})
	}

	if (updateStore) {
		// since we know we're not prefetching, we need to update the store with any errors
		if (result.errors && result.errors.length > 0) {
			store.update((s) => ({
				...s,
				errors: result.errors,
				isFetching: false,
				partial: false,
				data: result.data as _Data,
				source,
				variables,
			}))

			// don't go any further
			throw result.errors
		} else {
			store.set({
				data: (request.result.data || {}) as _Data,
				variables: variables || ({} as _Input),
				errors: request.result.errors,
				isFetching: false,
				partial: request.partial,
				source: request.source,
			})
		}
	}

	return request
}
