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

// Terms:
// - CSF: client side fetch. identified by a lack of loadEvent

// Notes:
// - load handles prefetch and server-side
//   - If the incoming variables on a load are different than the tracker, don't write to the store
// - load only populates the store on the server
// - load should _always_ perform a fetchAndCache
//   - it's guaranteed to run before the CSF because the change in variables is what triggers the CSF
//     - data won't necessarily be in the cache since blocking could be set to false
//
// - CSF must load the data aswell (pre-fetches don't get another invocation of load())
// - CSF must manage subscriptions
// - CSF must update variable tracker.
//
// - We have to prevent a link to the current route with different variables from sending two requests. One of load or CSF
//   has to detect that the other will happen and not do anything. Regardless of which, this stop only matters when a fetch
//   happens during navigation

// Questions:
// - Can we detect the first CSF by checking if the variable counter is null and there is a load function? Does that
//   mean we can remove the ssr source?
//
// - Prefetch test doesn't have a CSF. Without it, the prefetch detection doesn't work. A problem or something we can just document?

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

	// the first client-side request after the mocked load() needs to be blocked
	let blockNextCSF = false

	// we will be reading and write the last known variables often, avoid frequent gets and updates
	let lastVariables: _Input | null = null

	// track the subscription's existence to refresh and unsubscribe when unmounting
	let subscriptionSpec: SubscriptionSpec | null = null

	// if there is a load in progress when the CSF triggers we need to stop it
	let loadPending = false

	// a function to update the store's cache subscriptions
	function refreshSubscription(newVariables: _Input) {
		// if the variables changed we need to unsubscribe from the old fields and
		// listen to the new ones
		if (subscriptionSpec) {
			cache.unsubscribe(subscriptionSpec, lastVariables || {})
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

		// track the newVariables
		lastVariables = newVariables
	}

	// a function to fetch data (the root of the behavior tree described above)
	async function fetch(
		args?: QueryStoreFetchParams<_Input>
	): Promise<QueryResult<_Data, _Input>> {
		// validate and prepare the request context for the current environment (client vs server)
		const { context, policy, params } = fetchContext(artifact, storeName, args)

		// identify if this is a CSF or load
		const isLoadFetch = Boolean(params?.event)
		const isComponentFetch = !isLoadFetch

		// detect if there is a load function that fires before the first CSF
		if (isLoadFetch && lastVariables === null && Boolean(args?.event)) {
			blockNextCSF = true
		}

		// if there is a pending load, don't do anything
		if (loadPending && isComponentFetch) {
			return get(store)
		}

		if (isComponentFetch) {
			// a component fetch is _always_ blocking
			params.blocking = true
		}

		// the fetch is happening in a load
		if (isLoadFetch) {
			loadPending = true
		}

		// compute the variables we need to use for the query
		const newVariables = (marshalInputs({
			artifact,
			config,
			input: params?.variables,
		}) || {}) as _Input

		// check if the variables are different from the last time we saw them
		let variableChange = stry(lastVariables, 0) !== stry(newVariables, 0)

		// if we are loading on the client and the variables _are_ different, we have to
		// update the subscribers. do that before the fetch so we don't accidentally
		// cause the new data to trigger the old subscription after the store has been
		// update with fetchAndCache
		if (isComponentFetch && variableChange) {
			refreshSubscription(newVariables)
		}

		// there are a few cases where the CSF needs to be prevented:
		// - the last request was from a server-side rendered request (faked by svelte kit)
		// - the variables didn't change and we're not being forced to request it
		// - there is a pending load function
		if (
			isComponentFetch &&
			(blockNextCSF ||
				(!variableChange && params.policy !== CachePolicy.NetworkOnly) ||
				loadPending)
		) {
			blockNextCSF = false

			// make sure we return before the fetch happens
			return get(store)
		}

		// we want to update the store in four situations: ssr, csf, the first load of the ssr response,
		// or if we got this far and the variables haven't changed (avoid prefetch)
		const updateStore =
			!isBrowser ||
			isComponentFetch ||
			(lastVariables === null && variableChange) ||
			!variableChange

		// we might not want to wait for the fetch to resolve
		const fakeAwait = clientStarted && isBrowser && !params?.blocking

		// perform the network request
		const request = fetchAndCache({
			config,
			context,
			artifact,
			variables: newVariables,
			store,
			updateStore,
			cached: policy !== CachePolicy.NetworkOnly,
			setLoadPending: (val) => (loadPending = val),
		})

		// if we weren't told to block we're done (only valid for a client-side request)
		if (fakeAwait) {
			return get(store)
		}

		// if we got this far, we need to wait for the response from the request
		console.log(await request)

		// the store will have been updated already since we waited for the response
		return get(store)
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
					cache.unsubscribe(subscriptionSpec, lastVariables || {})
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
): { context: FetchContext; policy: CachePolicy; params: QueryStoreFetchParams<_Input> } {
	// if we aren't on the browser but there's no event there's a big mistake
	if (!isBrowser && (!params || !params.event || !params.event.fetch)) {
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
	if (!policy) {
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
	return { context, policy, params: params ?? {} }
}

async function fetchAndCache<_Data, _Input>({
	config,
	context,
	artifact,
	variables,
	store,
	updateStore,
	cached,
	ignoreFollowup,
	setLoadPending,
}: {
	config: ConfigFile
	context: FetchContext
	artifact: QueryArtifact
	variables: _Input
	store: Writable<QueryResult<_Data, _Input>>
	updateStore: boolean
	cached: boolean
	ignoreFollowup?: boolean
	setLoadPending: (pending: boolean) => void
}) {
	const request = await fetchQuery({
		context,
		artifact,
		variables,
		cached,
	})
	const { result, source, partial } = request

	// we're done
	setLoadPending(false)

	if (result.data) {
		// update the cache with the data that we just ran into
		cache.write({
			selection: artifact.selection,
			data: result.data,
			variables: variables || {},
		})
	}

	if (updateStore) {
		const unmarshaledData = unmarshalSelection(
			config,
			artifact.selection,
			result.data
		)! as _Data

		// since we know we're not prefetching, we need to update the store with any errors
		if (result.errors && result.errors.length > 0) {
			store.update((s) => ({
				...s,
				errors: result.errors,
				isFetching: false,
				partial: false,
				data: unmarshaledData,
				source,
				variables,
			}))

			// don't go any further
			throw result.errors
		} else {
			store.set({
				data: (unmarshaledData || {}) as _Data,
				variables: variables || ({} as _Input),
				errors: null,
				isFetching: false,
				partial: request.partial,
				source: request.source,
			})
		}
	}

	if (!ignoreFollowup) {
		// if the data was loaded from a cached value, and the document cache policy wants a
		// network request to be sent after the data was loaded, load the data
		if (source === DataSource.Cache && artifact.policy === CachePolicy.CacheAndNetwork) {
			fetchAndCache<_Data, _Input>({
				config,
				context,
				artifact,
				variables,
				store,
				cached: false,
				updateStore,
				ignoreFollowup: true,
				setLoadPending,
			})
		}
		// if we have a partial result and we can load the rest of the data
		// from the network, send the request
		if (partial && artifact.policy === CachePolicy.CacheOrNetwork) {
			fetchAndCache<_Data, _Input>({
				config,
				context,
				artifact,
				variables,
				store,
				cached: false,
				updateStore,
				ignoreFollowup: true,
				setLoadPending,
			})
		}
	}

	return request
}
