import type { Cache } from '$houdini/runtime/cache/cache'
import { DocumentStore, HoudiniClient } from '$houdini/runtime/client'
import { deepEquals } from '$houdini/runtime/lib/deepEquals'
import { LRUCache } from '$houdini/runtime/lib/lru'
import { GraphQLObject, GraphQLVariables } from '$houdini/runtime/lib/types'
import { QueryArtifact } from '$houdini/runtime/lib/types'
import React from 'react'

import { SuspenseCache } from '../lib/cache'
import { find_match } from '../lib/match'
import type { NavigationContext, RouterManifest, RouterPageManifest } from '../lib/types'

const NavContext = React.createContext<NavigationContext>({
	currentRoute: '/',
	goto: () => {
		throw new Error('NOT FOUND')
	},
})

/**
 * Router is the top level entry point for the filesystem-based router.
 * It is responsible for loading various page sources (including API fetches) and
 * then rendering when appropriate.
 */
// In order to enable streaming SSR, individual page and layouts components
// must suspend. We can't just have one big suspense that we handle
// or else we can't isolate the first chunk. That being said, we
// don't want network waterfalls. So we need to send the request for everything all
// at once and then wrap the children in the necessary context so that when they render
// they can grab what they need if its ready and suspend if not.
export function Router({ manifest }: { manifest: RouterManifest }) {
	// the current route is just a string in state.
	const [current, setCurrent] = React.useState(() => {
		return window.location.pathname
	})

	// find the matching page for the current route
	const [page, variables] = find_match(manifest, current)

	// the only time this component will directly suspend (instead of one of its children)
	// is if we don't have the component source. Dependencies on query results or artifacts
	// will be resolved by the component itself

	// load the page assets (source, artifacts, data). this will suspend if the component is not available yet
	// this hook embeds pending requests in context so that the component can suspend if necessary14
	useLoadPage({ page, variables })

	// if we get this far, it's safe to load the component
	const { component_cache, last_variables, data_cache } = useRouterContext()
	const PageComponent = component_cache.get(page.id)!

	//
	// Now that we know we aren't going to throw, let's set up the event listeners
	//

	// whenever the route changes, we need to make sure the browser's stack is up to date
	React.useEffect(() => {
		if (window.location.pathname !== current) {
			window.history.pushState({}, '', current)
		}
	}, [current])

	// when we first mount we should start listening to the back button
	React.useEffect(() => {
		const onChange = (evt: PopStateEvent) => {
			setCurrent(window.location.pathname)
		}
		window.addEventListener('popstate', onChange)
		return () => {
			window.removeEventListener('popstate', onChange)
		}
	}, [])

	// TODO: cleanup navigation caches!!
	// make sure that we clear up navigation caches
	// React.useEffect(() => {
	// 	return () => {
	// 		last_variables.delete(page.id)
	// 		data_cache.delete(page.id)
	// 	}
	// }, [page.id])

	// render the component embedded in the necessary context so it can orchestrate
	// its needs
	return (
		<NavContext.Provider
			value={{
				currentRoute: current,
				goto: setCurrent,
			}}
		>
			<PageComponent />
		</NavContext.Provider>
	)
}

/**
 * useLoadPage is responsible for kicking off the network requests necessary to render the page.
 * This includes loading the artifact, the component source, and any query results. This hook
 * suspends if the component source is not available.
 */
function useLoadPage({
	page,
	variables,
}: {
	page: RouterPageManifest
	variables: GraphQLVariables
}) {
	// grab context values
	const {
		client,
		cache,
		data_cache,
		component_cache,
		artifact_cache,
		pending_cache,
		last_variables,
	} = useRouterContext()

	// the function to load a query using the cache references
	function load_query({ id, artifact }: { id: string; artifact: QueryArtifact }): Promise<void> {
		// track the new variables
		last_variables.set(page.id, variables)

		// TODO: AbortController on send()
		// TODO: we can read from cache here before making an asynchronous network call

		// if there is a pending request and we were asked to load, don't do anything
		if (pending_cache.has(id)) {
			return pending_cache.get(id)!
		}

		// send the request
		const observer = client.observe({ artifact, cache })

		// add it to the pending cache
		pending_cache.set(
			id,
			new Promise<void>((resolve, reject) => {
				observer
					.send({
						variables: variables,
						cacheParams: { disableSubscriptions: true },
					})
					.then(() => {
						data_cache.set(id, observer)

						resolve()
					})
					.catch(reject)
					// we're done processing
					.finally(() => {
						pending_cache.delete(id)
					})
			})
		)

		// this promise is also what we want to do with the main invocation
		return pending_cache.get(id)!
	}

	// if the variables have changed then we need to clear the data store (so we fetch again)
	if (last_variables.has(page.id) && !deepEquals(last_variables.get(page.id), variables)) {
		data_cache.clear()
	}

	// in order to avoid waterfalls, we need to kick off APIs requests in parallel
	// to use loading any missing artifacts or the page component.

	// group the necessary based on wether we have their artifact or not
	const missing_artifacts: string[] = []
	const found_artifacts: Record<string, QueryArtifact> = {}
	for (const key of Object.keys(page.documents)) {
		if (artifact_cache.has(key)) {
			found_artifacts[key] = artifact_cache.get(key)!
		} else {
			missing_artifacts.push(key)
		}
	}

	// any missing artifacts need to be loaded and then have their queries loaded
	for (const artifact_id of missing_artifacts) {
		// load the artifact
		page.documents[artifact_id]
			.artifact()
			.then((mod) => {
				// the artifact is the default export
				const artifact = mod.default

				// save the artifact in the cache
				artifact_cache.set(artifact_id, artifact)

				// now that we have the artifact, we can load the query too
				load_query({ id: artifact.name, artifact })
			})
			.catch((err) => {
				// TODO: handle error
				console.log(err)
			})
	}

	// we need to make sure that every artifact we found is loaded
	// or else we need to load the query
	for (const artifact of Object.values(found_artifacts)) {
		// if we don't have the query, load it
		if (!data_cache.has(artifact.name)) {
			load_query({ id: artifact.name, artifact })
		}
	}

	// if we don't have the component then we need to load it, save it in the cache, and
	// then suspend with a promise that will resolve once its in cache
	if (!component_cache.has(page.id)) {
		throw new Promise<void>((resolve, reject) => {
			page.component()
				.then((mod) => {
					// save the component in the cache
					component_cache.set(page.id, mod.default)

					// we're done
					resolve()
				})
				.catch(reject)
		})
	}
}

export function useNavigationContext() {
	return React.useContext(NavContext)
}

export function RouterContextProvider({
	children,
	client,
	cache,
	artifact_cache,
	component_cache,
	data_cache,
	pending_cache,
	last_variables,
}: {
	children: React.ReactElement
	client: HoudiniClient
	cache: Cache
	artifact_cache: SuspenseCache<QueryArtifact>
	component_cache: SuspenseCache<(props: any) => React.ReactElement>
	data_cache: SuspenseCache<DocumentStore<GraphQLObject, GraphQLVariables>>
	pending_cache: PendingCache
	last_variables: LRUCache<GraphQLVariables>
}) {
	return (
		<Context.Provider
			value={{
				client,
				cache,
				artifact_cache,
				component_cache,
				data_cache,
				pending_cache,
				last_variables,
			}}
		>
			{children}
		</Context.Provider>
	)
}

type RouterContext = {
	client: HoudiniClient
	cache: Cache

	// We also need a cache for artifacts so that we can avoid suspending to
	// load them if possible.
	artifact_cache: SuspenseCache<QueryArtifact>

	// We also need a cache for component references so we can avoid suspending
	// when we load the same page multiple times
	component_cache: SuspenseCache<(props: any) => React.ReactElement>

	// Pages need a way to wait for data
	data_cache: SuspenseCache<DocumentStore<GraphQLObject, GraphQLVariables>>

	// A way to track pending requests for an artifact
	pending_cache: PendingCache

	// A way to track the last known good variables
	last_variables: LRUCache<GraphQLVariables>
}

export type PendingCache = SuspenseCache<Promise<void>>

const Context = React.createContext<RouterContext | null>(null)

export const useRouterContext = () => {
	const ctx = React.useContext(Context)
	if (!ctx) {
		throw new Error('Could not find router context')
	}

	return ctx
}

export function useClient() {
	return useRouterContext().client
}

export function useCache() {
	return useRouterContext().cache
}

export function useDocumentStore<_Data extends GraphQLObject, _Input extends GraphQLVariables>(
	name: string
): [_Data, DocumentStore<_Data, _Input>] {
	const store = useRouterContext().data_cache.get(name)!

	// @ts-ignore
	return [store.state.data!, store]
}
