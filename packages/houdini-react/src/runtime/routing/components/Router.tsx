import type { Cache } from '$houdini/runtime/cache/cache'
import { HoudiniClient } from '$houdini/runtime/client'
import { createLRUCache, LRUCache } from '$houdini/runtime/lib/lru'
import { GraphQLVariables } from '$houdini/runtime/lib/types'
import { QueryArtifact } from '$houdini/runtime/lib/types'
import React, { Suspense } from 'react'

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

	// grab the important data for the matching page. this will suspend while we
	// load the page's component.
	const { Component } = usePage(...find_match(manifest, current))

	// render the component embedded in the necessary context so it can orchestrate
	// its needs
	return (
		<NavContext.Provider
			value={{
				currentRoute: current,
				goto: setCurrent,
			}}
		>
			<Component />
		</NavContext.Provider>
	)
}

/**
 * Returns everything that's needed to render a page. It might potentially suspend
 * to load bundle information but query fetches and artifact loads won't be waited on til a page asks for it.
 * This way the we don't get network waterfalls but fallbacks aren't rendered until we can.
 */
function usePage(
	manifest: RouterPageManifest,
	variables: GraphQLVariables
): {
	Component: (props: any) => React.ReactElement
} {
	// the only time this component will directly suspend (instead of one of its children)
	// is if we dont have the component source. Dependencies on query results or artifacts
	// will be resolved by the component itself
	const component_cache = useComponentPageCache()
	let suspend = !component_cache.has(manifest.id)

	// see if we have an entry for this navigation
	const navigation_cache = useNavigationCache()
	const nav_unit = navigation_cache.get(manifest.id)

	// if we got this far, the component is allowed to start suspending while it waits for
	// things to load
	return {
		Component: component_cache.get(manifest.id)!,
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
				artifact_cache: createLRUCache(),
				component_cache: createLRUCache(),
				navigation_cache: createLRUCache(),
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
	artifact_cache: LRUCache<QueryArtifact>

	// We also need a cache for component references so we can avoid suspending
	// when we load the same page multiple times
	component_cache: LRUCache<(props: any) => React.ReactElement>

	navigation_cache: LRUCache<NavigationSuspenseUnit>
}

const Context = React.createContext<RouterContext | null>(null)

const useContext = () => {
	const ctx = React.useContext(Context)
	if (!ctx) {
		throw new Error('Could not find router context')
	}

	return ctx
}

type NavigationSuspenseUnit = {
	id: string

	// the cache unit is an externally resolvable promise
	then: (val: any) => any
	resolve: () => void
	reject: (err: any) => void

	//
	page: RouterPageManifest
	variables: GraphQLVariables
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

function useNavigationCache() {
	return useContext().navigation_cache
}
