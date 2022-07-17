// externals
import { derived, get, Readable, Writable, writable } from 'svelte/store'
import type { LoadEvent } from '@sveltejs/kit'
// internals
import { CachePolicy, DataSource, fetchQuery, GraphQLObject, QueryStore } from '..'
import { clientStarted, getSession, isBrowser } from '../adapter'
import cache from '../cache'
import {
	FetchContext,
	QueryResult,
	QueryStoreFetchParams,
	SubscriptionSpec,
	deepEquals,
} from '../lib'
import type { ConfigFile, QueryArtifact } from '../lib'
import { getHoudiniContext, nullHoudiniContext } from '../lib/context'
import { PageInfo, PaginatedHandlers, queryHandlers } from '../lib/pagination'
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

// our query store needs to be able to handle concurrent requests from users with different sessions
// without leaking data. In order to do this, a query store is going to store independent versions for
// every req_id that it encounters. We're going to then use that `req_id` in the session during store subscribe
// in order to get the value that was loaded fetch
export type QueryResultMap<_Data, _Input> = {
	[req_id: string]: Writable<QueryResult<_Data, _Input> & { pageInfo?: PageInfo }>
}

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
	const initialState = (): Writable<QueryResult<_Data, _Input> & { pageInfo?: PageInfo }> =>
		writable({
			data: null,
			errors: null,
			isFetching: false,
			partial: false,
			source: null,
			variables: null,
		})

	// at its core, a query store is a writable store with extra methods
	const data: QueryResultMap<_Data, _Input> = {}
	const setFetching = (req_id: string, isFetching: boolean) =>
		data[req_id]?.update((s) => ({ ...s, isFetching }))
	const getVariables = (req_id: string) => get(data[req_id]).variables

	// the first client-side request after the mocked load() needs to be blocked
	let blockNextCSF = false

	// we will be reading and write the last known variables often, avoid frequent gets and updates
	let lastVariables: _Input | null = null

	// track the subscription's existence to refresh and unsubscribe when unmounting
	let subscriptionSpec: SubscriptionSpec | null = null

	// if there is a load in progress when the CSF triggers we need to stop it
	let loadPending = false

	// in order to clear the store's value when unmounting, we need to track how many concurrent subscribers
	// we have. when this number is 0, we need to clear the store
	let subscriberCount = 0

	// a function to update the store's cache subscriptions
	function refreshSubscription(req_id: string, newVariables: _Input) {
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
			set: (newValue) => data[req_id]?.update((s) => ({ ...s, data: newValue })),
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

		// get the req_id from the session
		// @ts-ignore
		let { req_id } = context.session
		if (!req_id) {
			while (!req_id || data[req_id]) {
				req_id = Math.random()
			}

			// @ts-ignore
			context.session.req_id = req_id
		}

		// if we dont have an entry for this req_id already,  create one
		if (!data[req_id]) {
			data[req_id] = initialState()
		}

		// identify if this is a CSF or load
		const isLoadFetch = Boolean('event' in params && params.event)
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
		if (isLoadFetch && lastVariables === null && Boolean('event' in (args || {}))) {
			blockNextCSF = true
		}

		// if we are loading on the client and the variables _are_ different, we have to
		// update the subscribers. do that before the fetch so we don't accidentally
		// cause the new data to trigger the old subscription after the store has been
		// update with fetchAndCache
		if (isComponentFetch && variableChange) {
			refreshSubscription(req_id, newVariables)
			data[req_id].update((s) => ({ ...s, variables: newVariables }))
		}

		// if there is a pending load, don't do anything
		if (loadPending && isComponentFetch) {
			// if the variables haven't changed and we dont have an active subscription
			// then we need to start listening
			if (!variableChange && subscriptionSpec === null) {
				refreshSubscription(req_id, newVariables)
			}

			return get(data[req_id])
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
					store: data[req_id],
					updateStore: true,
					cached: true,
					policy: CachePolicy.CacheOnly,
					setLoadPending: (val) => {
						loadPending = val
						setFetching(req_id, val)
					},
				})
			}

			// if we dont have a subscription but we're ending early we need to listen for
			// changes
			if (subscriptionSpec === null) {
				refreshSubscription(req_id, newVariables)
			}

			// make sure we return before the fetch happens
			return get(data[req_id])
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

		setFetching(req_id, true)

		// perform the network request
		const request = fetchAndCache({
			config,
			context,
			artifact,
			variables: newVariables,
			store: data[req_id],
			updateStore,
			cached: policy !== CachePolicy.NetworkOnly,
			setLoadPending: (val) => {
				loadPending = val
				setFetching(req_id, val)
			},
		})

		// if we weren't told to block we're done (only valid for a client-side request)
		if (!fakeAwait) {
			// if we got this far, we need to wait for the response from the request
			await request
		}

		// the store will have been updated already since we waited for the response
		return get(data[req_id])
	}

	// add the pagination methods to the store
	let extraMethods: {} = {}
	let pageInfos: ReturnType<typeof queryHandlers>['pageInfo'] = {}

	if (paginated) {
		const handlers = queryHandlers({
			storeName,
			config,
			artifact,
			stores: data,
			async fetch(params) {
				return (await fetch({
					...params,
					blocking: true,
				}))!
			},
			queryVariables() {
				const session = getSession()
				const { req_id } = get(session)

				return getVariables(req_id)
			},
		})

		extraMethods = Object.fromEntries(
			Object.entries(paginationMethods).map(([key, value]) => [key, handlers[value]])
		)

		// @ts-ignore
		;(extraMethods.pageInfo = {
			subscribe(...args: Parameters<Readable<PageInfo>['subscribe']>) {
				const session = getSession()
				const { req_id } = get(session)

				return handlers.pageInfo[req_id]?.subscribe(...args)
			},
		}),
			(pageInfos = handlers.pageInfo)
	}

	return {
		name: artifact.name,
		subscribe: (...args: Parameters<Readable<QueryResult<_Data, _Input>>['subscribe']>) => {
			const session = getSession()
			const { req_id } = get(session)

			// add the page info store if it exists
			const combined = derived([data[req_id], pageInfos[req_id]], ([store, pageInfo]) => {
				const everything = { ...store }
				if (pageInfo) {
					everything.pageInfo = pageInfo
				}

				return everything
			})

			const bubbleUp = combined.subscribe(...args)

			// we have a new subscriber
			subscriberCount++

			// Handle unsubscribe
			return () => {
				// we lost a subscriber
				subscriberCount--

				// don't clear the store state on the server (breaks SSR)
				// or when there is still an active subscriber
				if (isBrowser && subscriberCount <= 0) {
					// clean up any cache subscriptions
					if (subscriptionSpec) {
						cache.unsubscribe(subscriptionSpec, lastVariables || {})
						subscriptionSpec = null
					}

					// clear the variable counter
					lastVariables = null

					// reset the store value
					delete data[req_id]
				}

				// we're done
				bubbleUp()
			}
		},
		fetch,
		...extraMethods,
	}
}

export function fetchContext<_Data, _Input>(
	artifact: QueryArtifact,
	storeName: string,
	params?: QueryStoreFetchParams<_Input>
): { context: FetchContext; policy: CachePolicy; params: QueryStoreFetchParams<_Input> } {
	// if we aren't on the browser but there's no event there's a big mistake
	if (
		!isBrowser &&
		!(params && 'fetch' in params) &&
		(!params || !('event' in params) || !('fetch' in (params.event || {})))
	) {
		// prettier-ignore
		log.error(`
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
	import fetch from 'node-fetch'
	import { ${log.cyan(storeName)} } from '$houdini';

	export async function get(event) {
		return {
			props: {
				data: await  ${log.cyan(storeName)}.fetch({ event, fetch })
			}
		};
	}

`)

		throw new Error('Error, check above logs for help.')
	}

	let houdiniContext = (params && 'context' in params && params.context) || null
	houdiniContext ??= nullHoudiniContext()

	// looking at the session will error while prerendering
	let session: App.Session | null = null
	try {
		if (
			params &&
			'event' in params &&
			params.event &&
			'session' in params.event &&
			params.event.session
		) {
			session = params.event.session
		} else {
			session = houdiniContext.session?.()
		}
	} catch {}

	// figure out the right policy
	let policy = params?.policy
	if (!policy) {
		// use the artifact policy as the default, otherwise prefer the cache over the network
		policy = artifact.policy ?? CachePolicy.CacheOrNetwork
	}

	// figure out the right fetch to use
	let fetch: LoadEvent['fetch'] | null = null
	if (params) {
		if ('fetch' in params && params.fetch) {
			fetch = params.fetch
		} else if ('event' in params && params.event && 'fetch' in params.event) {
			fetch = params.event.fetch
		}
	}

	if (!fetch) {
		if (isBrowser) {
			fetch = window.fetch.bind(window)
		} else {
			throw new Error('Cannot find fetch to use')
		}
	}

	// find the right stuff
	let stuff = houdiniContext?.stuff?.() || {}
	if (params && 'event' in params && params.event && 'stuff' in params.event) {
		stuff = params.event.stuff
	}

	return {
		context: {
			fetch,
			metadata: params?.metadata ?? {},
			session,
			stuff,
		},
		policy,
		params: params ?? {},
	}
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
