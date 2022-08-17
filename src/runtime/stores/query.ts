import type { LoadEvent } from '@sveltejs/kit'
import { derived, get, readable, Readable, Writable, writable } from 'svelte/store'

// internals
import { CachePolicy, DataSource, fetchQuery, GraphQLObject, HoudiniClient, QueryStore } from '..'
import { clientStarted, isBrowser } from '../adapter'
import cache from '../cache'
import {
	FetchContext,
	QueryResult,
	QueryStoreFetchParams,
	SubscriptionSpec,
	deepEquals,
	CompiledQueryKind,
	HoudiniFetchContext,
} from '../lib'
import type { ConfigFile, QueryArtifact } from '../lib'
import { getHoudiniContext, nullHoudiniContext } from '../lib/context'
import * as log from '../lib/log'
import { PageInfo, PaginatedHandlers, queryHandlers } from '../lib/pagination'
import { marshalInputs, unmarshalSelection } from '../lib/scalars'

export function queryStore<_Data extends GraphQLObject, _Input>({
	config,
	client,
	artifact,
	storeName,
	paginationMethods,
	paginated,
	variables,
}: {
	config: ConfigFile
	client: HoudiniClient
	artifact: QueryArtifact
	paginated: boolean
	storeName: string
	paginationMethods: (keyof PaginatedHandlers<_Data, _Input>)[]
	variables: boolean
}): QueryStore<_Data, _Input> {
	// at its core, a query store is a writable store with extra methods
	const store: Writable<QueryResult<_Data, _Input> & { pageInfo?: PageInfo }> = writable(
		initialState()
	)
	const setFetching = (isFetching: boolean) => store?.update((s) => ({ ...s, isFetching }))
	const getVariables = (): _Input | null => get(store)?.variables || null

	// we will be reading and write the last known variables often, avoid frequent gets and updates
	let lastVariables: _Input | null = null

	// track the subscription's existence to refresh and unsubscribe when unmounting
	let subscriptionSpec: SubscriptionSpec | null = null

	// if there is a load in progress when the CSF triggers we need to stop it
	let loadPending = false

	// in order to clear the store's value when unmounting, we need to track how many concurrent subscribers
	// we have. when this number is 0, we need to clear the store
	let subscriberCount = 0

	let ctx: HoudiniFetchContext | null = null
	// try to get the current context in case the factory was invoked somewhere that allows for it
	try {
		ctx = getHoudiniContext(true)
	} catch {}

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
			set: (newValue) => store.update((s) => ({ ...s, data: newValue })),
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
		const { context, policy, parentContext, params } = fetchParams(
			ctx,
			artifact,
			storeName,
			args
		)

		// save the context we were given (if there is one)
		if (!ctx && parentContext) {
			ctx = parentContext
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

		// if we are loading on the client and the variables _are_ different, we have to
		// update the subscribers. do that before the fetch so we don't accidentally
		// cause the new data to trigger the old subscription after the store has been
		// update with fetchAndCache
		if (isComponentFetch && variableChange) {
			refreshSubscription(newVariables)
			store.update((s) => ({ ...s, variables: newVariables }))
		}

		// if there is a pending load, don't do anything
		if (loadPending && isComponentFetch) {
			log.error(`⚠️ Encountered fetch from your component while ${storeName}.load was running.
This will result in duplicate queries. If you are trying to ensure there is always a good value, please a CachePolicy instead.
If this is leftovers from old versions of houdini, you can safely remove this \`${storeName}\`.fetch() from your component.
`)

			return get(store)
		}

		// a component fetch is _always_ blocking
		if (isComponentFetch) {
			params.blocking = true
		}

		// the fetch is happening in a load
		if (isLoadFetch) {
			loadPending = true
		}

		// we might not want to wait for the fetch to resolve
		const fakeAwait = clientStarted && isBrowser && !params?.blocking

		setFetching(true)

		// perform the network request
		const request = fetchAndCache({
			client,
			config,
			context,
			artifact,
			variables: newVariables,
			store,
			cached: policy !== CachePolicy.NetworkOnly,
			setLoadPending: (val) => {
				loadPending = val
				setFetching(val)
			},
		})

		// if the await isn't fake, await it
		if (!fakeAwait) {
			await request
		}

		// the store will have been updated already since we waited for the response
		return get(store)
	}

	// add the pagination methods to the store
	let extraMethods: Record<string, any> = {}
	let pageInfo: Readable<PageInfo> | null = null

	if (paginated) {
		const handlers = queryHandlers<_Data, _Input>({
			storeName,
			config,
			artifact,
			store,
			async fetch(params) {
				return (await fetch({
					...params,
					blocking: true,
				}))!
			},
			queryVariables: getVariables,
			getContext: () => ctx,
		})

		extraMethods = Object.fromEntries(paginationMethods.map((key) => [key, handlers[key]]))
		extraMethods.paginationStrategy = handlers.paginationStrategy
		pageInfo = handlers.pageInfo ?? null
	}

	return {
		name: artifact.name,
		artifact,
		kind: CompiledQueryKind,
		variables,
		setContext(context: HoudiniFetchContext) {
			ctx = context
		},
		subscribe: (...args: Parameters<Readable<QueryResult<_Data, _Input>>['subscribe']>) => {
			// add the page info store if it exists
			const combined = derived([store, pageInfo || readable(null)], ([$store, $pageInfo]) => {
				const everything = { ...$store }
				if ($pageInfo) {
					everything.pageInfo = $pageInfo
				}

				return everything
			})

			const bubbleUp = combined.subscribe(...args)

			// we have a new subscriber
			subscriberCount = (subscriberCount ?? 0) + 1

			// Handle unsubscribe
			return () => {
				// we lost a subscriber
				subscriberCount--

				// don't clear the store state on the server (breaks SSR)
				// or when there is still an active subscriber
				if (subscriberCount <= 0) {
					// clean up any cache subscriptions
					if (isBrowser && subscriptionSpec) {
						cache.unsubscribe(subscriptionSpec, lastVariables || {})
						subscriptionSpec = null
					}

					// clear the variable counter
					lastVariables = null
				}

				// we're done
				bubbleUp()
			}
		},
		fetch,
		...extraMethods,
	}
}

async function fetchAndCache<_Data extends GraphQLObject, _Input>({
	config,
	context,
	artifact,
	variables,
	store,
	cached,
	ignoreFollowup,
	setLoadPending,
	policy,
	client,
}: {
	config: ConfigFile
	context: FetchContext
	artifact: QueryArtifact
	variables: _Input
	store: Writable<QueryResult<_Data, _Input>>
	cached: boolean
	ignoreFollowup?: boolean
	setLoadPending: (pending: boolean) => void
	policy?: CachePolicy
	client: HoudiniClient
}) {
	const request = await fetchQuery<_Data, _Input>({
		config,
		context,
		artifact,
		variables,
		cached,
		policy,
		client,
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

	if (!ignoreFollowup) {
		// if the data was loaded from a cached value, and the document cache policy wants a
		// network request to be sent after the data was loaded, load the data
		if (source === DataSource.Cache && artifact.policy === CachePolicy.CacheAndNetwork) {
			fetchAndCache<_Data, _Input>({
				client,
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
			fetchAndCache<_Data, _Input>({
				client,
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

function initialState() {
	return {
		data: null,
		errors: null,
		isFetching: false,
		partial: false,
		source: null,
		variables: null,
	}
}

export function fetchParams<_Data, _Input>(
	parentContext: HoudiniFetchContext | null,
	artifact: QueryArtifact,
	storeName: string,
	params?: QueryStoreFetchParams<_Input>
): {
	context: FetchContext
	parentContext?: HoudiniFetchContext
	policy: CachePolicy
	params: QueryStoreFetchParams<_Input>
} {
	// if we aren't on the browser but there's no event there's a big mistake
	if (
		!isBrowser &&
		!(params && 'fetch' in params) &&
		(!params || !('event' in params) || !('fetch' in (params.event || {})))
	) {
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

	let houdiniContext = parentContext || (params && 'context' in params && params.context)
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

	// figure out the right fetch to use
	let fetchFn: LoadEvent['fetch'] | null = null

	if (params) {
		if ('fetch' in params && params.fetch) {
			fetchFn = params.fetch
		} else if ('event' in params && params.event && 'fetch' in params.event) {
			fetchFn = params.event.fetch
		}
	}

	if (!fetchFn) {
		if (isBrowser) {
			fetchFn = window.fetch.bind(window)
		} else {
			fetchFn = fetch
		}
	}

	return {
		context: {
			fetch: fetchFn,
			metadata: params?.metadata ?? {},
			session,
		},
		policy,
		params: params ?? {},
		parentContext: houdiniContext,
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
