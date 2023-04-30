import type { Cache } from '$houdini/runtime/cache/cache'
import { HoudiniClient } from '$houdini/runtime/client'
import { DocumentStore } from '$houdini/runtime/client/documentStore'
import { deepEquals } from '$houdini/runtime/lib/deepEquals'
import { createLRUCache } from '$houdini/runtime/lib/lru'
import type { QueryArtifact, GraphQLObject, GraphQLVariables } from '$houdini/runtime/lib/types'
import React, { createContext, Suspense, useContext, useEffect, useState } from 'react'

import { HoudiniProvider } from '../../context'
import { exec, find_match } from '../lib/match'
import { RouterContext, RouterManifest, RouterPageManifest } from '../lib/types'

const Context = createContext<RouterContext>({
	currentRoute: '/1',
	goto: () => {
		throw new Error('NOT FOUND')
	},
})

// TODO: WHEN TO CLEAN UP ROUTER CACHES??

// Since navigation can potentially suspend while component and/or data
// is being fetched, we need a place to put things so that when we resolve
// the suspended promises it can look up the value to use.
const nav_suspense_cache = createLRUCache<RouterSuspenseUnit>()

// We also need a cache for artifacts so that we can avoid suspending to
// load them if possible.
const artifact_cache = createLRUCache<QueryArtifact>()

// We also need a cache for component references so we can avoid suspending
// when we load the same page multiple times
const component_cache = createLRUCache<(props: any) => React.ReactElement>()

// The unit we are looking up when suspending has to track all of the state
// necessary to load a page bundle. This includes the data, component, and artifact.
type RouterSuspenseUnit = {
	id: string

	// the cache unit is an externally resolvable promise
	then: (val: any) => any
	resolve: () => void
	reject: (err: any) => void

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
// page assets, different components are shown.
//
// - In order to keep the tree shape stable, we want to always return a suspense boundary if we are ever
//   going to. That means that when we don't have a component to render yet, we are going to
//   render the suspense boundary with our fallback wrapping our fallback.
//
export function Router({
	cache,
	manifest,
	client,
}: {
	cache: Cache
	manifest: RouterManifest
	client: HoudiniClient
}) {
	// the current route is just a string in state.
	const [current, setCurrent] = useState(() => {
		return window.location.pathname
	})

	//
	// Now that we have our routing state, we need to figure out what we are
	// going to show.
	//

	// find the matching path (if it exists)
	const [match, matchVariables] = find_match(manifest, current)

	// we have a match. look check if the page bundle has been loaded enough for us
	// to show something.
	const identifier = match.id
	let cached = nav_suspense_cache.get(identifier)

	// if there is a pending request for this route, we need to abort it
	// since we are going to own the render now
	React.useEffect(() => {
		cached?.route_mutex?.signal.abort()
	}, [current])

	// there are 3 situations:
	//
	// - we already have an entry in the navigation suspense cache containing the
	//   component, every artifact, and data to render.
	// - we are here but not ready to render the UI. This could happen because we are missing the artifact,
	//   don't have enough data for the loading state. Whatever the reason, If there is something in progress, just throw the
	//   pending one.
	// - We don't have an entry for this route in the cache at all and nothing is in progress which means its a
	//   full load of a fresh page. Just throw the page bundle loader and it will resolve when its ready.

	// we have no cache entry for this route so we need to load the page bundle
	// and then come back here when we have something to render
	if (!cached || !deepEquals(matchVariables, cached.variables)) {
		// this might suspend
		load_bundle({
			manifest,
			id: identifier,
			variables: matchVariables ?? {},
			client,
			cache,
		})
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

	// if we got this far and we don't have something to return, then we need to just
	// wait on the cached value to be valid (we had a waterfall or an early suspend resolve!)
	if (!ok_final({ unit: cached })) {
		throw cached
	}

	//
	// Now that we know we aren't going to throw, let's set up the event listeners
	//

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

	// render the page
	return (
		<Context.Provider
			value={{
				currentRoute: current,
				goto: setCurrent,
			}}
		>
			<HoudiniProvider client={client}>
				<Suspense fallback={render_fallback(cache, cached)}>
					<Page cache={cache} unit={cached} />
				</Suspense>
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
	cache,
}: {
	manifest: RouterManifest
	id: string
	variables: Record<string, string>
	client: HoudiniClient
	cache: Cache
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
		cache,
		id,
		client,
		update: (u) => {
			u.bundle = {
				// this will get overwritten when appropriate.
				// this way it always has the default value.
				mode: 'loading',
				...u.bundle,
				artifacts: {
					...u.bundle?.artifacts,
					...found_artifacts,
				},
			}
		},
	})

	// load the missing artifacts
	for (const key of missing_artifacts) {
		// if there are missing artifacts, we have to suspend
		suspend = true

		// pull the loader out of the manifest
		const load_artifact = manifest.pages[id].documents[key].artifact

		// load the artifact and save it in the unit
		load_artifact().then(({ default: artifact }) => {
			// add the loaded artifact to the suspense unit
			update_unit({
				cache,
				id: unit.id,
				client,
				update: (u) => {
					u.bundle = {
						mode: 'loading',
						...u.bundle,
						artifacts: {
							...u.bundle?.artifacts,
							[key]: artifact,
						},
					}
				},
			})
		})
	}

	// and finally, load the component

	// check if the component is something we already know about
	const Component = component_cache.get(id)

	// if we have to load the component, we have to suspend
	if (!Component) {
		suspend = true
		manifest.pages[id].component().then(({ default: component }) => {
			component_cache.set(id, component)

			// add the loaded component to the suspense unit
			update_unit({
				cache,
				client,
				id: unit.id,
				update: (u) => {
					u.bundle = {
						mode: 'loading',
						...u.bundle,
						Component: component,
					}
				},
			})
		})
	} else {
		update_unit({
			cache,
			client,
			id: unit.id,
			update: (u) => {
				u.bundle = {
					mode: 'loading',
					...u.bundle,
					Component,
				}
			},
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
	cache,
}: {
	id: string
	update: (old: RouterSuspenseUnit) => void
	client: HoudiniClient
	cache: Cache
}) {
	// we need to track if we have to suspend
	let suspend = false

	/**
	 * Apply the updates
	 */
	const unit = nav_suspense_cache.get(id)!
	update(unit)

	// zip every query result and artifact and make sure that our store definitions
	// exist when appropriate. since we only care about overlapping keys, we can
	// just choose one and move on.
	for (const [key, result] of Object.entries(unit.bundle?.data ?? {})) {
		const artifact = unit.bundle?.artifacts?.[key]
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
	for (const [key, artifact] of Object.entries(unit.bundle?.artifacts ?? {})) {
		if (artifact && !unit.pending[key]) {
			// we are about to send a new request
			unit.pending[key] = new AbortController()
			suspend = true

			// TODO: AbortController on send()
			// TODO: we can read from cache here before making an asynchronous network call

			// send the request
			const observer = client.observe({ artifact, cache })
			observer
				.send({
					variables: unit.variables,
					cacheParams: { disableSubscriptions: true },
				})
				.then(({ data }) => {
					// and clean up anything we did along the way
					observer.cleanup()

					// hold onto the value in the suspense unit
					update_unit({
						cache,
						id: unit.id,
						client,
						update: (u) => {
							u.bundle = {
								mode: 'loading',
								...u.bundle,
								data: {
									...u.bundle?.data,
									[key]: {
										...u.bundle?.data?.[key],
										value: data,
									},
								},
							}
						},
					})
				})
		}
	}

	/**
	 * Clean up the unit
	 */

	// check the unit is now finalized
	if (ok_final({ unit: unit })) {
		unit.bundle!.mode = 'final'
	}

	if (unit.route_mutex?.signal.signal.aborted) {
		return false
	}

	// if the mode is finalized we are good to go
	if (unit.bundle?.mode === 'final') {
		unit.resolve()
		unit.route_mutex = null
		return suspend
	}

	return suspend
}

function ok_final({ unit }: { unit: RouterSuspenseUnit }) {
	const data = unit.bundle?.data
	return !!(
		data &&
		Object.keys(unit.page.documents).every((key) => key in data && data[key].store) &&
		unit.bundle?.Component
	)
}

function render_fallback(cache: Cache, unit: RouterSuspenseUnit) {
	// TODO: +fallback.tsx
	// if none of the documents are loading then we just return null for now
	if (Object.values(unit.page.documents).map((doc) => doc.loading).length === 0) {
		return null
	}

	return <Page cache={cache} unit={unit} loading />
}

function Page({
	cache,
	unit,
	loading,
}: {
	cache: Cache
	unit: RouterSuspenseUnit
	loading?: boolean
}) {
	// pull out the component from the bundle
	const Component = unit.bundle!.Component!
	// build up the props to pass by looking at the queries
	const props: Record<string, any> = {}
	for (const name of Object.keys(unit.page.documents)) {
		props[name] = unit.bundle?.data?.[name].value
		props[`${name}$handle`] = unit.bundle?.data?.[name].store
	}

	// if we are loading then should overwrite any loading documents
	// with generated loading states
	if (loading) {
		for (const [name, document] of Object.entries(unit.page.documents)) {
			const selection = unit.bundle?.artifacts?.[name]?.selection

			if (!document.loading || !selection) {
				continue
			}

			// we need to apply loading states to the ones that support it
			props[name] = cache.read({
				selection,
				loading: true,
			})
		}
	}

	return <Component {...props} />
}
