import type { Cache } from '$houdini/runtime/cache/cache'
import { DocumentStore, HoudiniClient } from '$houdini/runtime/client'
import { GraphQLObject, GraphQLVariables } from '$houdini/runtime/lib/types'
import { QueryArtifact } from '$houdini/runtime/lib/types'
import React, { Suspense } from 'react'

import { SuspenseCache, suspense_cache } from '../lib/cache'
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
export function Router({ cache, manifest }: { cache: Cache; manifest: RouterManifest }) {
	// the current route is just a string in state.
	const [current, setCurrent] = React.useState(() => {
		return window.location.pathname
	})

	// find the matching page for the current route
	const [match, matchVariables] = find_match(manifest, current)

	// the only time this component will directly suspend (instead of one of its children)
	// is if we don't have the component source. Dependencies on query results or artifacts
	// will be resolved by the component itself
	const component_cache = useComponentPageCache()

	// load the page assets (source, artifacts, data). this will suspend if the component is not available yet
	// this hook embeds pending requests in context so that the component can suspend if necessary14
	useLoadPage(match, matchVariables)

	// if we get this far, it's safe to load the component
	const Page = component_cache.get(match.id)!

	// render the component embedded in the necessary context so it can orchestrate
	// its needs
	return (
		<NavContext.Provider
			value={{
				currentRoute: current,
				goto: setCurrent,
			}}
		>
			<Page />
		</NavContext.Provider>
	)
}

/**
 * useLoadPage is responsible for kicking off the network requests necessary to render the page.
 * This includes loading the artifact, the component source, and any query results. This hook
 * suspends if the component source is not available.
 */
function useLoadPage(page: RouterPageManifest, variables: GraphQLVariables) {
	// grab the coordination
	const artifact_cache = useArtifactCache()
	const component_cache = useComponentPageCache()
	const data_cache = useDataCache()

	// the function to load a query using the cache references
	async function load_query({
		artifact,
		client,
	}: {
		artifact: QueryArtifact
		client: HoudiniClient
	}) {}

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
	fallback,
	client,
}: {
	children: React.ReactElement
	fallback: React.ReactElement
	client: HoudiniClient
}) {
	return (
		<Context.Provider
			value={{
				client,
				artifact_cache: suspense_cache(),
				component_cache: suspense_cache(),
				data_cache: suspense_cache(),
			}}
		>
			<Suspense fallback={fallback}>{children}</Suspense>
		</Context.Provider>
	)
}

type RouterContext = {
	client: HoudiniClient

	// We also need a cache for artifacts so that we can avoid suspending to
	// load them if possible.
	artifact_cache: SuspenseCache<QueryArtifact>

	// We also need a cache for component references so we can avoid suspending
	// when we load the same page multiple times
	component_cache: SuspenseCache<(props: any) => React.ReactElement>

	// Pages need a way to wait for data
	data_cache: SuspenseCache<[any, DocumentStore<GraphQLObject, GraphQLVariables>]>
}

const Context = React.createContext<RouterContext | null>(null)

const useContext = () => {
	const ctx = React.useContext(Context)
	if (!ctx) {
		throw new Error('Could not find router context')
	}

	return ctx
}

// Utilities for pulling values from context

/** Returns the current client */
export function useClient() {
	return useContext().client
}

/** Returns the cache of page components */
function useComponentPageCache() {
	return useContext().component_cache
}

/** Returns the cache of artifacts */
function useArtifactCache() {
	return useContext().artifact_cache
}

/** Returns the cache of results */
function useDataCache() {
	return useContext().data_cache
}
