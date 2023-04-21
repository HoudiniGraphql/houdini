import { createLRUCache } from '$houdini/runtime/lib/lru'
import type { QueryArtifact, GraphQLObject, GraphQLVariables } from '$houdini/runtime/lib/types'
import React, { createContext, useContext, useEffect, useState } from 'react'

import { RouteParam } from './match'

// RouterManifest contains all of the information that the router needs
// to decide what bundle to load and render for a given url
export type RouterManifest = {
	pages: RouterPageManifest[]
}

export type RouterPageManifest = {
	// the url pattern to match against. created from './match/parse_page_pattern'
	pattern: RegExp
	params: RouteParam[]
	page_id: string
}

export type RouterContext = {
	currentRoute: string
	goto: (route: string) => void
}

const Context = createContext<RouterContext>({
	currentRoute: '/1',
	goto: () => {
		throw new Error('NOT FOUND')
	},
})

// Since navigation can potentially suspend while component and/or data
// is being fetched, we need a place to put things so that when we resolve
// the suspended promises it can look up the value to use.
//
// What is my cache key? If I use the raw url then I won't be able to distinguish
// between different variables. If a url is loaded that _is_ the same pattern
// but a different input then we might need to abort an existing fetch with the old variables
// and load it with the new ones

const nav_suspense_cache = createLRUCache<RouterSuspenseUnit>()
type RouterSuspenseUnit = {
	// the cache unit is an externally resolvable promise
	then: (val: any) => any
	resolve: () => void

	// if we try to load the same route with different variables twice,
	// we need to prevent the old request from resolving the suspense unit
	pending?: {
		variables: GraphQLVariables
		signal: AbortController
	}

	// the resolved key does not just hold onto one value but instead
	// an object that describes the current state of the route.
	// this lets us resolve the suspense at various points so that the
	// router can render loading states, the full view, etc.
	resolved?: {
		// when this has a value, we have a component that should be shown
		// on the ui. It might be a React.lazy if we have a loading state
		// and the artifact has loaded
		Component: (props: any) => React.ReactNode

		// the artifact for the the query
		artifact?: QueryArtifact

		// the data the use for every dependent query
		// on the page
		data?: Record<string, GraphQLObject>
	}
}

// The router component is the central entry point for the application. It is responsible
// for keeping the browser's URL in sync with the application state. Thi means rendering
// the appropriate component for a given url. It does this by matching the url against a manifest of pages.
//
// In order to render, a particular route needs 3 things:
// - the artifacts for every query that the view depends on
// - the data for every query
// - the actual component to render
//
export function Router({ manifest }: { manifest: RouterManifest }) {
	//
	// The first bit of this component is just setting up the basic state and event listeners
	//

	// the current route is just a string in state.
	const [current, setCurrent] = useState(() => {
		return window.location.pathname
	})

	// whenever the route changes, we need to make sure the browser's stack is up to date
	useEffect(() => {
		if (window.location.pathname !== current) {
			window.history.pushState({}, '', current)
		}
	}, [current])

	// when we first mount we should start listening to the backbutton
	useEffect(() => {
		const onChange = (evt: PopStateEvent) => {
			setCurrent(window.location.pathname)
		}
		window.addEventListener('popstate', onChange)
		return () => {
			window.removeEventListener('popstate', onChange)
		}
	}, [])

	//
	// Now that we have our routing state, we need to figure out what we are
	// going to show.
	//

	// find the matching path (if it exists)
	let match: RouterPageManifest | null = null
	for (const page of manifest.pages) {
		// check if the current url matches
		const urlMatch = current.match(page.pattern)
		if (!urlMatch) {
			continue
		}

		// we found a match!!
		if (page.pattern.test(current)) {
			match = page
			break
		}
	}

	// if there is no match we have a 404!
	if (!match) {
		throw new Error('404')
	}

	// we have a match. now we need to figure out what to show
	// a given view is defined by the string pattern corresponding to
	// its location on the file system.
	const identifier = match.page_id
	const cached = nav_suspense_cache.get(identifier)

	// if there is a pending request for this route, we need to abort it
	// since we are going to own the render now
	cached?.pending?.signal.abort()

	// the possible loading states for a route are constrained from the top down
	// in order for a child route to show, the parent layout's dependencies must
	// either have a value we can use, or a loading state.

	// there are 4 situations:
	// - we already have an entry in the navigation suspense cache containing the
	//   component, every artifact, and data to render.
	// - we have an entry in the suspense cache containing the artifact, the component,
	//   and we have _enough_ data to render the page's loading state. For some pages, this
	//   might just require the artifact.
	// - we are here but not ready to render the UI. This could happen because we are missing the artifact,
	//   don't have enough data for the loading state. Whatever the reason, If there is something in progress, just throw the
	//   pending one.
	// - We don't have an entry for this route in the cache at all if nothing is in progress, its a
	//   full load of a fresh page. Just throw the page bundle loader and it will resolve when its ready

	// the value we will render
	let result: React.ReactNode | null = null

	// we have no cache entry for this route so we need to load the page bundle
	// and then come back here when we have something to render
	if (!cached) {
		throw loadBundle({ manifest, id: match.page_id })
	}
	// before we go to far, if the value isn't even resolved yet then let's just wait on it
	if (!cached.resolved || !cached.resolved.artifact) {
		if (!cached.resolved?.artifact) {
			console.log('early suspend without artifact!!!')
		}

		throw cached
	}

	// we have a cached entry and it was resolved. clearly then someone thinks we have enough data to render something

	result = <div>page!</div>

	// if we got this far and we don't have something to return, then we need to just
	// wait on the cached value to be valid (we had a waterfall or an early suspend resolve!)
	if (!result) {
		throw cached
	}

	// render the page
	return (
		<Context.Provider
			value={{
				currentRoute: current,
				goto: setCurrent,
			}}
		>
			{result}
		</Context.Provider>
	)
}

export function useRouterContext() {
	return useContext(Context)
}

// when we need to load a new page for the first time we need to throw something
// that looks like a promise and has some state that we can mutate as information comes in from the server.
// when enough data has come in to show _something_, then we will resolve the promise but still let the
// data by mutated by other queries that might not be necessary to show the loading state.
function loadBundle({ manifest, id }: { manifest: RouterManifest; id: string }) {
	// there has to be a promise at the center of all of this
	let resolve: (() => void) | null = null
	let reject: (() => void) | null = null
	const promise = new Promise<void>((res, rej) => {
		resolve = res
		reject = rej
	})

	// return the promise that will be resolved when we call resolve
	return promise
}
