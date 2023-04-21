import { DocumentStore } from '$houdini/runtime/client/documentStore'
import { createLRUCache } from '$houdini/runtime/lib/lru'
import type { QueryArtifact, GraphQLObject, GraphQLVariables } from '$houdini/runtime/lib/types'
import React, { createContext, useContext, useEffect, useState } from 'react'

import { exec, RouteParam } from './match'

// RouterManifest contains all of the information that the router needs
// to decide what bundle to load and render for a given url
export type RouterManifest = {
	pages: Record<string, RouterPageManifest>
}

export type RouterPageManifest = {
	// the url pattern to match against. created from './match/parse_page_pattern'
	pattern: RegExp
	params: RouteParam[]
	id: string

	// loaders for the 3 units of information that we need to render a page
	// and its loading state
	load_query: Record<string, () => Promise<any>>
	load_artifact: Record<string, () => Promise<QueryArtifact>>
	load_component: () => Promise<(props: any) => React.ReactNode>

	// a page needs to know which queries its waiting on. If enough data has loaded
	// to show the loading state (all of the required queries have values) then its
	// safe to resolve the query. This field tracks those names
	required_queries: string[]
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
	reject: (err: any) => void

	required_queries: string[]

	// if we try to load the same route with different variables twice,
	// we need to prevent the old request from resolving the suspense unit
	pending?: {
		variables: GraphQLVariables
		signal: AbortController
	} | null

	// the resolved key does not just hold onto one value but instead
	// an object that describes the current state of the route.
	// this lets us resolve the suspense at various points so that the
	// router can render loading states, the full view, etc.
	bundle?: {
		mode: 'loading' | 'final'

		// when this has a value, we have a component that should be shown
		// on the ui. It might be a React.lazy if we have a loading state
		// and the artifact has loaded but we're still waiting on the data
		Component?: (props: any) => React.ReactNode

		// the artifacts for the the page all get set at once and are very static.
		// could be deployed with different cache headers on a CDN
		artifacts?: Record<string, QueryArtifact>

		// the data the use for every query on the page
		data?: Record<
			string,
			{
				store: DocumentStore<GraphQLObject, GraphQLVariables>
				value: GraphQLObject
			}
		>
	}
}

// The router component is the central entry point for the application. It is responsible
// for keeping the browser's URL in sync with the application state. Thi means rendering
// the appropriate component for a given url. It does this by matching the url against a manifest of pages.
//
// If the router has the necessary information to render a page, it will do so. otherwise it will suspend
// while the page's bundle is loading. Depending on the order that information resolves for the
// page assets, different components are shown:
//
// - If the artifacts come before both of them and we don't have the required data, we can resolve the
//   suspension and render the loading state (mode = "loading")
// - When we are rendering the loading state, we want to do that by rendering a suspense boundary.
// - In order to keep the tree shape stable, we want to always return a suspense boundary if we are ever
//   going to. That means that when we don't have a component to render yet, we are going to
//   render the suspense boundary with our fallback wrapping our fallback.
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
	let matchVariables: Record<string, string> | null = null
	for (const page of Object.values(manifest.pages)) {
		// check if the current url matches
		const urlMatch = current.match(page.pattern)
		if (!urlMatch) {
			continue
		}

		// we found a match!!
		if (page.pattern.test(current)) {
			match = page
			matchVariables = exec(urlMatch, page.params) || {}
			break
		}
	}

	// if there is no match we have a 404!
	if (!match) {
		throw new Error('404')
	}

	// we have a match. look check if the page bundle has been loaded enough for us
	// to show something.
	const identifier = match.id
	let cached = nav_suspense_cache.get(identifier)

	// if there is a pending request for this route, we need to abort it
	// since we are going to own the render now
	cached?.pending?.signal.abort()

	// there are 4 situations:
	//
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
		// this might suspend
		load_bundle({ manifest, id: match.id, variables: matchVariables ?? {} })
		// or it might just prime the cache with good values somehow
		cached = nav_suspense_cache.get(identifier)
		if (!cached) {
			throw new Error('Could not load bundle for some reason...')
		}
	}

	// before we go to far, if the value isn't even resolved yet then let's just wait on it.
	// ideally, we'd never get here because we should only have a resolved value
	// that's good to render but there might be a bug...
	if (!cached.bundle || !cached.bundle.artifacts || !cached.bundle.Component) {
		if (!cached.bundle?.artifacts) {
			console.log('early suspend without artifacts!!!')
		}
		if (!cached.bundle?.Component) {
			console.log('early suspend without Component!!!')
		}

		// *sob*
		throw cached
	}

	// pull out the information we need
	const { data } = cached.bundle

	// if we have enough data to render the full state and store instances for everything,
	// we're good to go
	if (data && ok_final({ required: match.required_queries, data })) {
		result = render_page(cached.bundle)
	}

	// maybe we have enough data to render the loading state?
	else if (ok_loadingState({ unit: cached, data })) {
		result = render_loading_state(cached.bundle)
	}

	// if we got this far and we don't have something to return, then we need to just
	// wait on the cached value to be valid (we had a waterfall or an early suspend resolve!)
	else if (!result) {
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
function load_bundle({
	manifest,
	id,
	variables,
}: {
	manifest: RouterManifest
	id: string
	variables: Record<string, string>
}) {
	// there has to be a promise at the center of all of this
	let resolve: (() => void) | null = null
	let reject: (() => void) | null = null
	const promise = new Promise<void>((res, rej) => {
		resolve = res
		reject = rej
	})

	if (!resolve || !reject) {
		return
	}

	// build up the suspense unit that we will cache
	const unit: RouterSuspenseUnit = {
		then: promise.then,
		resolve,
		reject,
		required_queries: manifest.pages[id].required_queries,
		pending: {
			variables,
			signal: new AbortController(),
		},
	}
	// save this unit in the cache ASAP so we don't double up
	nav_suspense_cache.set(id, unit)

	// there are 3 things we have to do
	// - load the artifacts
	// - load the data
	// - load the components
	for (const [key, loader] of Object.entries(manifest.pages[id].load_artifact)) {
		// load the artifact and save it in the unit
		loader().then((artifact) => {
			// add the loaded artifact to the suspense unit
			update_unit(unit, (u) => ({
				...u,
				bundle: {
					// this will get overwritten when appropriate.
					// this way it always has the default value.
					mode: 'loading',
					...u.bundle,
					artifacts: {
						...u.bundle?.artifacts,
						[key]: artifact,
					},
				},
			}))
		})
	}

	// load all of the data
	for (const [key, loader] of Object.entries(manifest.pages[id].load_query)) {
		// TOOD: pass variables to each query to load
		loader().then(({ data }) => {
			// add the loaded artifact to the suspense unit
			update_unit(unit, (u) => ({
				...u,
				bundle: {
					// this will get overwritten when appropriate.
					// this way it always has the default value.
					mode: 'loading',
					...u.bundle,
					data: {
						...u.bundle?.artifacts,
						[key]: data,
					},
				},
			}))
		})
	}

	// and finally, load the component
	manifest.pages[id].load_component().then((component) => {
		// add the loaded component to the suspense unit
		update_unit(unit, (u) => ({
			...u,
			bundle: {
				// this will get overwritten when appropriate.
				// this way it always has the default value.
				mode: 'loading',
				...u.bundle,
				Component: component,
			},
		}))
	})

	// if we got this far we need to load the bundle so just throw the unit and let the
	// loaders do their job.
	throw unit
}

// Data comes in from all sorts of different places. this function applies the
// changes to the suspense unit and decides when its time to resolve the unit
// so that the view can render.
//
// once we have the artifact, we need to check if we can show a loading state and
// resolve the promise
//
// once we have the artifact and the data, we can create the document store with the initial values
// from the queries.
function update_unit(
	base: RouterSuspenseUnit,
	update: (old: RouterSuspenseUnit) => RouterSuspenseUnit
) {
	// apply the update to one copy of base
	const updated = update(base) as RouterSuspenseUnit

	// zip every query result and artifact and make sure that our store definitions
	// exist when appropriate

	// check the unit is now finalized
	const data = updated.bundle?.data
	if (ok_final({ required: updated.required_queries, data }) && updated.bundle?.Component) {
		updated.bundle!.mode = 'final'
	}

	// if this is aborted, we're done
	if (updated.pending?.signal.abort) {
		return
	}

	// if the mode is finalized we are good to go
	if (updated.bundle?.mode === 'final') {
		updated.resolve()
		updated.pending = null
		return
	}

	// if the unit has enough information to render the loading
	// state then we should do that.
	if (ok_loadingState({ unit: updated, data })) {
		updated.resolve()
	}
}

function render_page(resolved: Required<RouterSuspenseUnit>['bundle']) {
	return <div>hello!</div>
}

// the possible loading states for a route are constrained from the top down
// in order for a child route to show, the parent layout's dependencies must
// either have a value we can use, or a loading state.
function render_loading_state(resolved: Required<RouterSuspenseUnit>['bundle']) {
	return <div>loading...!</div>
}

function ok_loadingState({
	unit,
	data,
}: {
	unit: RouterSuspenseUnit
	data: Required<RouterSuspenseUnit>['bundle']['data']
}) {
	return unit.required_queries.filter((query) => !(query in (data ?? {}))).length === 0
}

function ok_final({
	required,
	data,
}: {
	required: string[]
	data: Required<RouterSuspenseUnit>['bundle']['data']
}) {
	return data && Object.keys(required).every((key) => key in data && data[key].store)
}
