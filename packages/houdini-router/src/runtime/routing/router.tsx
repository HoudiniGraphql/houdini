import { createLRUCache } from '$houdini/runtime/lib/lru'
import type { QueryArtifact, GraphQLObject, GraphQLVariables } from '$houdini/runtime/lib/types'
import React, { createContext, useContext, useEffect, useState } from 'react'

import { RuntimeManifest } from '../types'

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

// The router component is the central entry point for the application. It is responsible
// for keeping the browser's URL in sync with the application state. Thi means rendering
// the appropriate component for a given url. It does this by matching the url against a manifest of pages.
export function Router({ manifest }: { manifest: RuntimeManifest }) {
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

	// compute the identifier for this navigation state

	// the possible loading states for a route are constrained from the top down
	// in order for a child route to show, the parent layout's dependencies must
	// either have a value we can use, or a loading state.

	// there are 3 situations:
	// - we already have an entry in the navigation suspense cache containing the
	//   component, every artifact, and data to render.
	// - we have an entry in the suspense cache containing the artifact, the component,
	//   and we have _enough_ data to render the page's loading state. For some pages, this
	//   might just require the artifact.
	// - we are missing the artifact, don't have enough data for the loading state, or
	//   we don't have an entry for this route in the cache at all. Whatever the reason,
	//   we are not ready to render the UI. If there is something in progress, just throw the
	//   pending one. if nothing is in progress, its a full load of a fresh page. Just throw the
	//   page bundle loader

	return (
		<Context.Provider
			value={{
				currentRoute: current,
				goto: setCurrent,
			}}
		></Context.Provider>
	)
}

export function useRouterContext() {
	return useContext(Context)
}

// Since navigations can potentially suspend while component and/or data
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
