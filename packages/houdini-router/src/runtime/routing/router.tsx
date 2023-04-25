// @ts-ignore: this comes from houdini-react
import { HoudiniProvider } from '$houdini'
import { HoudiniClient } from '$houdini/runtime/client'
import { DocumentStore } from '$houdini/runtime/client/documentStore'
import { createLRUCache } from '$houdini/runtime/lib/lru'
import type { QueryArtifact, GraphQLObject, GraphQLVariables } from '$houdini/runtime/lib/types'
import React, { createContext, Suspense, useContext, useEffect, useState } from 'react'

import { exec, RouteParam } from './match'

// RouterManifest contains all of the information that the router needs
// to decide what bundle to load and render for a given url
export type RouterManifest = {
	pages: Record<string, RouterPageManifest>
}

export type RouterPageManifest = {
	id: string

	// the url pattern to match against. created from './match/parse_page_pattern'
	pattern: RegExp
	// the params used to execute the pattern and extract the variables
	params: RouteParam[]

	// loaders for the information that we need to render a page
	// and its loading state
	documents: Record<string, () => Promise<{ default: QueryArtifact }>>
	component: () => Promise<{ default: (props: any) => React.ReactElement }>

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
const nav_suspense_cache = createLRUCache<RouterSuspenseUnit>()

// What is my cache key? If I use the raw url then I won't be able to distinguish
// between different variables. If a url is loaded that _is_ the same pattern
// but a different input then we need to set a flag so that the previous fetch doesn't
// incorrectly resolve the suspension.

// We also need a second cache for artifacts so that we can avoid suspending to
// load them if possible.
const artifact_cache = createLRUCache<QueryArtifact>()

// The unit we are looking up when suspending has to track all of the state
// necessary to load a page bundle. This includes the data, component, and artifact.
type RouterSuspenseUnit = {
	id: string

	// the cache unit is an externally resolvable promise
	then: (val: any) => any
	resolve: () => void
	reject: (err: any) => void

	required_queries: string[]

	// if we try to load the same route with different variables twice,
	// we need to prevent the old request from resolving the suspense unit
	route_mutex?: {
		variables: GraphQLVariables
		signal: AbortController
	} | null

	// data can only be fetched once we have the artifact.
	// this means that we need to track wether we have a
	// pending request. if we don't have a pending request
	// when we've loaded the artifact, we can fetch the data
	pending: Record<string, AbortController | null>

	page: RouterPageManifest
	variables: GraphQLVariables

	// the resolved key does not just hold onto one value but instead
	// an object that describes the current state of the route.
	// this lets us resolve the suspense at various points so that the
	// router can render loading states, the full view, etc.
	bundle?: {
		mode: 'loading' | 'final'

		// when this has a value, we have a component that should be shown
		// on the ui. It might be a React.lazy if we have a loading state
		// and the artifact has loaded but we're still waiting on the data
		Component?: (props: any) => React.ReactElement

		// the artifacts for the the page all get set at once and are very static.
		// could be deployed with different cache headers on a CDN
		artifacts?: Record<string, QueryArtifact>

		// the data the use for every query on the page
		data?: Record<
			string,
			{
				store?: DocumentStore<GraphQLObject, GraphQLVariables>
				value: GraphQLObject | null
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
export function Router({ manifest, client }: { manifest: RouterManifest; client: HoudiniClient }) {
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

	// when we first mount we should start listening to the back button
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
		match = page
		matchVariables = exec(urlMatch, page.params) || {}
		break
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
	cached?.route_mutex?.signal.abort()

	// there are 4 situations:
	//
	// - we already have an entry in the navigation suspense cache containing the
	//   component, every artifact, and data to render.
	// - we have an entry in the suspense cache containing the artifact and
	//   and we have _enough_ data to render the page's loading state. For some pages, this
	//   might just require the artifact.
	// - we are here but not ready to render the UI. This could happen because we are missing the artifact,
	//   don't have enough data for the loading state. Whatever the reason, If there is something in progress, just throw the
	//   pending one.
	// - We don't have an entry for this route in the cache at all if nothing is in progress, its a
	//   full load of a fresh page. Just throw the page bundle loader and it will resolve when its ready

	// the value we will render
	let result: React.ReactElement | null = null

	// TODO: change of variables on the current view

	// we have no cache entry for this route so we need to load the page bundle
	// and then come back here when we have something to render
	if (!cached) {
		// this might suspend
		load_bundle({ manifest, id: identifier, variables: matchVariables ?? {}, client })
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
		// *sob*
		throw cached
	}

	// pull out the information we need
	const { data } = cached.bundle

	// if we have enough data to render the full state and store instances for everything,
	// we're good to go
	if (ok_final({ unit: cached })) {
		result = render_final(cached)
	}

	// maybe we have enough data to render the loading state?
	else if (ok_fallback({ unit: cached, data })) {
		result = render_fallback(cached)
	}

	// if we got this far and we don't have something to return, then we need to just
	// wait on the cached value to be valid (we had a waterfall or an early suspend resolve!)
	if (!result) {
		throw cached
	}

	// if we get this far we have to be okay to render the loading state
	// if (!ok_fallback({ unit: cached, data })) {
	// 	throw cached
	// }

	// render the page
	return (
		<Context.Provider
			value={{
				currentRoute: current,
				goto: setCurrent,
			}}
		>
			<HoudiniProvider client={client}>
				<Suspense fallback={render_fallback(cached)}>{result}</Suspense>
			</HoudiniProvider>
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
	client,
}: {
	manifest: RouterManifest
	id: string
	variables: Record<string, string>
	client: HoudiniClient
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
		id,
		page: manifest.pages[id],
		variables,
		then: promise.then.bind(promise),
		resolve,
		reject,
		required_queries: manifest.pages[id].required_queries,
		route_mutex: {
			variables,
			signal: new AbortController(),
		},
		pending: {},
	}
	// save this unit in the cache ASAP so we don't double up
	nav_suspense_cache.set(id, unit)

	// there are 3 things we have to do
	// - load the artifacts
	// - load the data
	// - load the components
	//
	// but it's possible that we don't have to suspend to do it.
	let suspend = false

	// load the artifacts
	const missing_artifacts: string[] = []

	// bundle the found artifacts into a single update
	const found_artifacts: Record<string, any> = {}
	for (const key of Object.keys(manifest.pages[id].documents)) {
		// if we have the artifact already, then we don't need to load it
		if (artifact_cache.has(key)) {
			found_artifacts[key] = artifact_cache.get(key)
		} else {
			missing_artifacts.push(key)
		}
	}

	// this update might suspend (ie if we have all the artifacts and no data)
	suspend ||= update_unit({
		id,
		client,
		update: (u) => ({
			...u,
			bundle: {
				// this will get overwritten when appropriate.
				// this way it always has the default value.
				mode: 'loading',
				...u.bundle,
				artifacts: {
					...u.bundle?.artifacts,
					...found_artifacts,
				},
			},
		}),
	})

	// load the missing artifacts
	for (const key of missing_artifacts) {
		// if there are missing artifacts, we have to suspend
		suspend = true

		// pull the loader out of the manifest
		const load_artifact = manifest.pages[id].documents[key]

		// load the artifact and save it in the unit
		load_artifact().then(({ default: artifact }) => {
			// add the loaded artifact to the suspense unit
			update_unit({
				id: unit.id,
				client,
				update: (u) => ({
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
				}),
			})
		})
	}

	// and finally, load the component

	// check if the component is something we already know about

	// if we have to load the component, we have to suspend
	if (!unit.bundle?.Component) {
		suspend = true
		manifest.pages[id].component().then(({ default: component }) => {
			// add the loaded component to the suspense unit
			update_unit({
				client,
				id: unit.id,
				update: (u) => ({
					...u,
					bundle: {
						// this will get overwritten when appropriate.
						// this way it always has the default value.
						mode: 'loading',
						...u.bundle,
						Component: component,
					},
				}),
			})
		})
	}

	// if we don't have all of the necessary information, we need to pause
	// util the unit is ready to be continue
	if (suspend) {
		throw unit
	}

	// if we don't have to suspend we can just move on (the suspense unit is already cached and updated)
	return
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
function update_unit({
	id,
	update,
	client,
}: {
	id: string
	update: (old: RouterSuspenseUnit) => RouterSuspenseUnit
	client: HoudiniClient
}) {
	// we need to track if we have to suspend
	let suspend = false

	/**
	 * Apply the updates
	 */
	const updated = update(nav_suspense_cache.get(id)!) as RouterSuspenseUnit
	nav_suspense_cache.set(id, updated)

	// zip every query result and artifact and make sure that our store definitions
	// exist when appropriate. since we only care about overlapping keys, we can
	// just choose one and move on.
	for (const [key, result] of Object.entries(updated.bundle?.data ?? {})) {
		const artifact = updated.bundle?.artifacts?.[key]
		if (result.store || !result.value || !artifact) {
			continue
		}
		result.store = client.observe({ artifact, initialValue: result.value })
	}

	/**
	 * Send any necessary requests
	 */

	// any artifact that we have that does not have a pending request should
	// be triggered.
	//
	// note: this currently happens only once for any given route. it's assumed
	// that once it's happened the store will be used for updates
	for (const [key, artifact] of Object.entries(updated.bundle?.artifacts ?? {})) {
		if (artifact && !updated.pending[key]) {
			// we are about to send a new request
			updated.pending[key] = new AbortController()
			suspend = true

			// TODO: AbortController on send()
			// TODO: we can read from cache here before making an asynchronous network call

			// send the request
			const observer = client.observe({ artifact })
			observer
				.send({
					variables: updated.variables,
					cacheParams: { disableSubscriptions: true },
				})
				.then(({ data }) => {
					// and clean up anything we did along the way
					observer.cleanup()

					// get the latest reference
					const base = nav_suspense_cache.get(updated.id)!

					// hold onto the value in the suspense unit
					update_unit({
						id: base.id,
						client,
						update: (u) => ({
							...u,
							bundle: {
								mode: 'loading',
								...u.bundle,
								data: {
									...u.bundle?.data,
									[key]: {
										...u.bundle?.data?.[key],
										value: data,
									},
								},
							},
						}),
					})
				})
		}
	}

	/**
	 * Clean up the unit
	 */

	// check the unit is now finalized
	const data = updated.bundle?.data
	if (ok_final({ unit: updated })) {
		updated.bundle!.mode = 'final'
	}

	// TODO: if this is aborted, we're done. don't suspend because of anything we did here.
	// if (updated.route_mutex?.signal.abort) {
	// return false
	// }

	// if the mode is finalized we are good to go
	if (updated.bundle?.mode === 'final') {
		updated.resolve()
		updated.route_mutex = null
		return suspend
	}

	// if the unit has enough information to render the loading
	// state then we should do that.
	if (ok_fallback({ unit: updated, data })) {
		updated.resolve()
	}

	return suspend
}

// the possible loading states for a route are constrained from the top down
// in order for a child route to show, the parent layout's dependencies must
// either have a value we can use, or a loading state.
function render_fallback(resolved: RouterSuspenseUnit) {
	return <div>loading...!</div>
}

function render_final(resolved: RouterSuspenseUnit) {
	const Component = resolved.bundle!.Component!
	// in order to know the props to pass, we need to look at the queries
	const props: Record<string, any> = {}
	for (const name of Object.keys(resolved.page.documents)) {
		props[name] = resolved.bundle?.data?.[name].value
		props[`${name}$handle`] = resolved.bundle?.data?.[name].store
	}

	return <Component {...props} />
}

function ok_fallback({
	unit,
	data,
}: {
	unit: RouterSuspenseUnit
	data: Required<RouterSuspenseUnit>['bundle']['data']
}) {
	// we can't show the loading state if we are missing required data.
	const has_data = unit.required_queries.filter((query) => !(query in (data ?? {}))).length === 0

	// we also can't show the loading state if we are missing any artifacts
	const has_artifacts = Object.keys(unit.page.documents).every(
		(art) => unit.bundle?.artifacts?.[art]
	)

	return has_data && has_artifacts
}

function ok_final({ unit }: { unit: RouterSuspenseUnit }) {
	const data = unit.bundle?.data

	return !!(
		data &&
		Object.keys(unit.required_queries).every((key) => key in data && data[key].store) &&
		unit.bundle?.Component
	)
}
