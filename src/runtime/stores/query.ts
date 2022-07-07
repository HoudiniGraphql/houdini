// externals
import { derived, get, Readable, Writable, writable } from 'svelte/store'
// internals
import { CachePolicy, DataSource, fetchQuery, GraphQLObject, QueryStore } from '..'
import { clientStarted, isBrowser } from '../adapter'
import cache from '../cache'
import {
	FetchContext,
	QueryResult,
	QueryStoreFetchParams,
	SubscriptionSpec,
	deepEquals,
} from '../lib'
import type { ConfigFile, QueryArtifact } from '../lib'
import { nullHoudiniContext } from '../lib/context'
import { PageInfo, PaginatedHandlers, queryHandlers, nullPageInfo } from '../lib/pagination'
import { marshalInputs, unmarshalSelection } from '../lib/scalars'
import * as log from '../lib/log'

// Terms:
// - CSF: client side fetch. identified by a lack of loadEvent
//
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
// - CSF might happen when load is also firing
//   - avoid the double request
//   - still need to subscribe to data
//

export function queryStore<_Data extends GraphQLObject, _Input>({
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
	// only include pageInfo in the store state if the query is paginated
	const initialState = (): QueryResult<_Data, _Input> & { pageInfo?: PageInfo } => ({
		data: null,
		errors: null,
		isFetching: false,
		partial: false,
		source: null,
		variables: null,
	})

	// at its core, a query store is a writable store with extra methods
	const store = writable(initialState())
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

		// compute the variables we need to use for the query
		const input = (marshalInputs({
			artifact,
			config,
			input: params?.variables,
		}) || {}) as _Input
		const newVariables = {
			...lastVariables,
			...input,
		}

		// check if the variables are different from the last time we saw them
		let variableChange = !deepEquals(lastVariables, newVariables)

		// detect if there is a load function that fires before the first CSF
		if (isLoadFetch && lastVariables === null && Boolean(args?.event)) {
			blockNextCSF = true
		}

		// if we are loading on the client and the variables _are_ different, we have to
		// update the subscribers. do that before the fetch so we don't accidentally
		// cause the new data to trigger the old subscription after the store has been
		// update with fetchAndCache
		if (isComponentFetch && variableChange) {
			refreshSubscription(newVariables)
		}

		// if there is a pending load, don't do anything
		if (loadPending && isComponentFetch) {
			// if the variables haven't changed and we dont have an active subscription
			// then we need to start listening
			if (!variableChange && subscriptionSpec === null) {
				refreshSubscription(newVariables)
			}

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
			// if the variables didn't change, get the latest value and use that
			if (!variableChange) {
				await fetchAndCache<_Data, _Input>({
					config,
					context,
					artifact,
					variables: newVariables,
					store,
					updateStore: true,
					cached: true,
					policy: CachePolicy.CacheOnly,
					setLoadPending: (val) => {
						loadPending = val
						setFetching(val)
					},
				})
			}

			// if we dont have a subscription but we're ending early we need to listen for
			// changes
			if (subscriptionSpec === null) {
				refreshSubscription(newVariables)
			}

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

		setFetching(true)

		// perform the network request
		const request = fetchAndCache({
			config,
			context,
			artifact,
			variables: newVariables,
			store,
			updateStore,
			cached: policy !== CachePolicy.NetworkOnly,
			setLoadPending: (val) => {
				loadPending = val
				setFetching(val)
			},
		})

		// if we weren't told to block we're done (only valid for a client-side request)
		if (fakeAwait) {
			return get(store)
		}

		// if we got this far, we need to wait for the response from the request
		await request

		// the store will have been updated already since we waited for the response
		return get(store)
	}

	// we might need to mix multiple store values for the user
	const relevantStores: Readable<any>[] = [store]

	// add the pagination methods to the store
	let extraMethods: {} = {}
	if (paginated) {
		const handlers = queryHandlers({
			config,
			artifact,
			store: {
				name: artifact.name,
				subscribe: store.subscribe,
				async fetch(params?: QueryStoreFetchParams<_Input>) {
					return (await fetch({
						...params,
						blocking: true,
					}))!
				},
			},
			queryVariables: getVariables,
		})

		// we only want to add page info if we have to
		relevantStores.push(derived([handlers.pageInfo], ([pageInfo]) => ({ pageInfo })))

		extraMethods = Object.fromEntries(
			Object.entries(paginationMethods).map(([key, value]) => [key, handlers[value]])
		)
	}

	// mix any of the stores we care about
	const userFacingStore = derived(relevantStores, (stores) => Object.assign({}, ...stores))

	return {
		name: artifact.name,
		subscribe: (...args: Parameters<Readable<QueryResult<_Data, _Input>>['subscribe']>) => {
			const bubbleUp = userFacingStore.subscribe(...args)

			// Handle unsubscribe
			return () => {
				// clean up any cache subscriptions
				if (subscriptionSpec) {
					cache.unsubscribe(subscriptionSpec, lastVariables || {})
					subscriptionSpec = null
				}

				// clear the variable counter
				lastVariables = null

				// don't clear the store state on the server (breaks SSR)
				if (isBrowser) {
					// reset the store value
					store.set(initialState())
				}

				// we're done
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
		log.error(`
	${log.red(`Missing event args in load function`)}. 

	Two options:
	${log.cyan("1/ Prefetching & SSR")}
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

	${log.cyan("2/ Client only")}
	<script lang="ts">
		$: browser && ${log.cyan(storeName)}.fetch({ variables: { ... } });
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
		const houdiniContext = params?.context || nullHoudiniContext()
		context = {
			fetch: window.fetch.bind(window),
			session: houdiniContext.session?.(),
			stuff: houdiniContext.stuff || {},
		}
	}

	// Add metadata info to the context
	context = { ...context, metadata: params?.metadata }

	return { context, policy, params: params ?? {} }
}

async function fetchAndCache<_Data extends GraphQLObject, _Input>({
	config,
	context,
	artifact,
	variables,
	store,
	updateStore,
	cached,
	ignoreFollowup,
	setLoadPending,
	policy,
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
	policy?: CachePolicy
}) {
	const request = await fetchQuery<_Data, _Input>({
		config,
		context,
		artifact,
		variables,
		cached,
		policy,
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

	if (updateStore) {
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
			throw result.errors
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
				policy,
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
				policy,
			})
		}
	}

	return request
}
