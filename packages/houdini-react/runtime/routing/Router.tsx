import type { GraphQLError, GraphQLObject, GraphQLVariables } from 'houdini/runtime'
import type { QueryArtifact } from 'houdini/runtime'
import type { Cache } from 'houdini/runtime/cache'
import type { DocumentStore, HoudiniClient } from 'houdini/runtime/client'
import { getCurrentConfig } from '$houdini/runtime'
import configFile from '$houdini/runtime/imports/config'
import { deepEquals } from 'houdini/runtime'
import type { LRUCache } from 'houdini/runtime'
import { marshalSelection, marshalInputs, getAuthUrl, HOUDINI_SESSION_EVENT } from 'houdini/runtime'
import type { HoudiniSessionEventDetail } from 'houdini/runtime'
import { find_match, find_prefix_match } from 'houdini/router/match'
import type { RouterManifest, RouterPageManifest } from 'houdini/router/types'
import React from 'react'
import { useContext, useEffect } from 'react'

import {
	RouterContextObject as Context,
	LocationContext,
	Is404Context,
	NavigationContext,
	PageContext,
	PendingURLContext,
} from '../contexts.js'
import { escapeScriptTag } from '../escape.js'
import { buildHref, scalarUnmarshalers, unmarshalScalars } from '../resolve-href.js'
import type { Goto } from '../routes.js'
import { type DocumentHandle, useDocumentHandle } from '../hooks/useDocumentHandle.js'
import { useDocumentStore } from '../hooks/useDocumentStore.js'
import { type SuspenseCache, suspense_cache } from './cache.js'
import { GraphQLErrors, RoutingError, StatusContext } from './errors.js'

type PageComponent = React.ComponentType<{
	url: string
	showLoading?: boolean
	children?: React.ReactNode
}>

const PreloadWhich = {
	component: 'component',
	data: 'data',
	page: 'page',
} as const

type PreloadWhichValue = (typeof PreloadWhich)[keyof typeof PreloadWhich]
type ComponentType = any

// useLoadingState decides whether to show the route's @loading state during navigation.
// `active` is the navigation transition's pending flag. The state flips on only once
// `active` has been pending for at least `loadingDelay` ms (so fast navigations never
// show it). Once shown it stays on until BOTH of these are true, so a response landing
// just after the delay doesn't cause a skeleton flicker:
//   - it has been visible for at least `minDuration` ms
//   - the target page's data has landed (`waitForData` resolves)
// A navigation that starts while the state is already showing re-arms the minDuration
// clock, so the new destination's data can't flash in right as the original hold expires.
// Note that `active` flips false as soon as the loading frame commits (the frame doesn't
// suspend, so the transition finishes with it on screen) — which is why the hide side
// waits on the data explicitly instead of trusting `active`.
function useLoadingState({
	active,
	loadingDelay,
	minDuration,
	waitForData,
}: {
	active: boolean
	loadingDelay: number
	minDuration: number
	waitForData: () => Promise<void>
}): boolean {
	const [show, setShow] = React.useState(false)
	const shownAt = React.useRef<number | null>(null)

	React.useEffect(() => {
		if (active) {
			// already showing — a new navigation is starting while the loading state is
			// up. Keep it up, but re-arm the minimum-duration clock: measured from the
			// first show, the hold could expire right as this navigation's data lands,
			// flashing the freshly-loaded content in and out of the loading state.
			if (show) {
				shownAt.current = performance.now()
				return
			}
			// wait out the delay; if we're still pending, switch the loading state on
			const timeout = setTimeout(() => {
				shownAt.current = performance.now()
				setShow(true)
			}, loadingDelay)
			return () => clearTimeout(timeout)
		}

		// navigation finished. if we never showed the loading state, there's nothing to do
		if (!show) {
			return
		}
		// otherwise wait for the page's data, then keep the loading state up until it has
		// been visible for at least minDuration. waiting on the data here means the page
		// never mounts with its query still missing (which would re-suspend it into the
		// Suspense fallback and briefly double-render the frame).
		let cancelled = false
		let timeout: ReturnType<typeof setTimeout> | undefined
		waitForData().then(() => {
			if (cancelled) {
				return
			}
			const elapsed = performance.now() - (shownAt.current ?? performance.now())
			const remaining = Math.max(0, minDuration - elapsed)
			timeout = setTimeout(() => {
				shownAt.current = null
				setShow(false)
			}, remaining)
		})
		return () => {
			cancelled = true
			clearTimeout(timeout)
		}
	}, [active, show, loadingDelay, minDuration])

	return show
}

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
export function Router({
	manifest,
	initialURL,
	assetPrefix,
	injectToStream,
}: {
	manifest: RouterManifest<ComponentType>
	initialURL?: string
	assetPrefix: string
	injectToStream?: undefined | ((chunk: string) => void)
}) {
	// the current route is just a string in state.
	const [currentURL, setCurrentURL] = React.useState(() => {
		return initialURL || window.location.pathname + window.location.search
	})

	// Navigation runs inside a transition so React keeps the previously-rendered route
	// on screen while the next one loads (instead of immediately falling back to the
	// loading state). If the transition stays pending longer than `loadingDelay`, we
	// surface the route's @loading frame (see showLoading → the entry's page slot);
	// fast navigations never show it, and once shown it stays up for `minDuration`.
	const [isNavigating, startNavigation] = React.useTransition()

	// pendingURL tracks the navigation target *urgently* (outside the transition), so a
	// render that happens while the transition is still pending can tell whether it is
	// looking at the destination (transition lane: currentURL === pendingURL) or at the
	// still-committed previous route (urgent lane: currentURL lags behind). The loading
	// frame is only ever shown on the destination — see the showLoading prop below.
	const [pendingURL, setPendingURL] = React.useState<string | null>(null)

	// find the matching page for the current route. find_match also hands back the parsed
	// query string (declared search params coerced, UI-only keys raw). custom-scalar route
	// and search params arrive in their url transport form, so we unmarshal them once here
	// — the rich values feed both the query variables (which marshalInputs re-marshals for
	// the request) and useRoute()'s params/search.
	const [page, rawVariables, rawSearch] = find_match(manifest, currentURL)
	const unmarshalers = scalarUnmarshalers(
		[...(page?.params ?? []), ...(page?.searchParams ?? [])],
		getCurrentConfig()?.scalars
	)
	const variables = unmarshalScalars(rawVariables ?? {}, unmarshalers)
	const search = unmarshalScalars(rawSearch, unmarshalers)
	const is404 = !page
	// When no exact match, find the deepest prefix-matching page to render
	// its layout chain with NotFoundGate throwing inside the appropriate boundary.
	const targetPage = page ?? find_prefix_match(manifest, currentURL)
	if (!targetPage) {
		throw new RoutingError(404)
	}

	// the only time this component will directly suspend (instead of one of its children)
	// is if we don't have the component source. Dependencies on query results or artifacts
	// will be resolved by the component itself

	// load the page assets (source, artifacts, data). this will suspend if the component is not available yet
	// this hook embeds pending requests in context so that the component can suspend if necessary14
	const { loadData, loadComponent } = usePageData({
		page: targetPage,
		variables,
		assetPrefix,
		injectToStream,
	})
	// if we get this far, it's safe to load the component
	const { component_cache, data_cache } = useRouterContext()
	const PageComponent = component_cache.get(targetPage.id)!
	const [session] = useSession()

	// decide whether the entry should render its @loading frame instead of the page.
	// values come from the router config (bundled client-side; they're UI timing, not
	// secrets), clamped so a bad value can't schedule a negative timeout.
	const routerConfig = getCurrentConfig()?.router ?? {}
	const showLoading = useLoadingState({
		active: isNavigating,
		loadingDelay: Math.max(0, routerConfig.loadingDelay ?? 200),
		minDuration: Math.max(0, routerConfig.minDuration ?? 400),
		// resolves once every query of the page being rendered has a store in data_cache
		// (including error stores — load_query seeds those too, so an errored query
		// releases the loading state instead of pinning it)
		waitForData: () =>
			Promise.all(
				Object.keys(targetPage.documents).map((name) => data_cache.waitFor(name))
			).then(() => {}),
	})

	// if we got this far then we're past suspense

	//
	// Now that we know we aren't going to throw, let's set up the event listeners
	//

	// whenever the route changes, we need to make sure the browser's stack is up to date
	React.useEffect(() => {
		if (globalThis.window && window.location.pathname + window.location.search !== currentURL) {
			window.history.pushState({}, '', currentURL)
		}
	}, [currentURL])

	// when we first mount we should start listening to the back button
	React.useEffect(() => {
		if (!globalThis.window) {
			return
		}
		const onChange = (_evt: PopStateEvent) => {
			const url = window.location.pathname + window.location.search
			setPendingURL(url)
			startNavigation(() => {
				setCurrentURL(url)
			})
		}
		window.addEventListener('popstate', onChange)
		return () => {
			window.removeEventListener('popstate', onChange)
		}
	}, [])

	// On navigation (but not the initial mount), re-fire the route's already-cached
	// queries so each one's cache policy is honored (stale-while-revalidate). The
	// observers are kept, so a query whose variables are unchanged and whose policy
	// allows a cache read resolves without a loading frame; queries whose variables
	// changed (or aren't cached) are evicted + reloaded by loadData with their loading
	// state. We reuse the variables already unmarshaled for this render rather than
	// re-parsing the URL. This also covers back/forward (popstate), which bypasses goto.
	// The guard compares URLs (not a boolean) so Strict Mode's double effect invocation
	// on mount doesn't slip past it and revalidate the initial page.
	const lastRevalidatedURL = React.useRef(currentURL)
	React.useEffect(() => {
		if (lastRevalidatedURL.current === currentURL) {
			return
		}
		lastRevalidatedURL.current = currentURL
		for (const name of Object.keys(targetPage.documents)) {
			if (data_cache.has(name)) {
				data_cache.get(name).send({ variables, session })
			}
		}
	}, [currentURL])

	// the function to call to navigate. accepts either a ready-made url string or a
	// typed target { to, params, search } that is assembled (and custom scalars
	// marshaled) exactly the way <Link> builds its href. The typed surface is the
	// shared Goto contract; the implementation takes the loose runtime shape.
	const goto = ((
		target:
			| string
			| { to: string; params?: Record<string, unknown>; search?: Record<string, unknown> }
	) => {
		const url =
			typeof target === 'string'
				? target
				: buildHref(
						target.to,
						manifest.pages[manifest.pagesByUrl[target.to]],
						getCurrentConfig()?.scalars,
						target.params,
						target.search
					)

		// We intentionally don't blanket-clear the data cache on navigation (that would
		// force every query back through its loading state). Observers and their data
		// survive, and per-query revalidation is handled by the navigation effect above
		// (which honors each query's cache policy). A real session change still clears
		// the cache (updateSession / the session event listener).

		// track the destination urgently (so in-flight renders can identify it) and
		// perform the navigation inside a transition so React keeps the current route on
		// screen until the next one is ready (or until showLoading swaps in the frame).
		setPendingURL(url)
		startNavigation(() => {
			setCurrentURL(url)
		})
	}) as Goto

	// links are powered using anchor tags that we intercept and handle ourselves
	useLinkBehavior({
		goto,
		preload(url: string, which: PreloadWhichValue) {
			// there are 2 things that we could preload: the page component and the data

			// look for the matching route information
			const [page, rawVariables] = find_match(manifest, url)
			if (!page) {
				return
			}
			// unmarshal any custom-scalar route/search params so the preloaded query
			// marshals them the same way the rendered one does
			const variables = unmarshalScalars(
				rawVariables ?? {},
				scalarUnmarshalers(
					[...page.params, ...page.searchParams],
					getCurrentConfig()?.scalars
				)
			)

			// load the page component if necessary
			if (['page', 'component'].includes(which)) {
				loadComponent(page)
			}

			// load the page component if necessary
			if (['page', 'data'].includes(which)) {
				loadData(page, variables)
			}
		},
	})

	// The loading frame only renders on the destination of the navigation: while a
	// transition is pending, the committed tree still has the previous currentURL
	// (pendingURL differs), so an urgent re-render of it — e.g. the showLoading flip —
	// keeps showing the previous page instead of swapping it for its own frame. The
	// destination (transition lane, where currentURL === pendingURL) renders the frame,
	// which doesn't suspend, so the transition commits as soon as the rest of the entry
	// (component, artifacts, layout data) is renderable.
	const showFrame = showLoading && currentURL === pendingURL

	// the public pending-navigation surface (useNavigation). A navigation counts as
	// pending until the destination shows its actual content: the transition can commit
	// with the @loading frame on screen (isNavigating flips false then), so the loading
	// state extends it. Memoized so consumers only re-render when it actually changes.
	const navigating = isNavigating || showLoading
	const navigation = React.useMemo(
		() => ({ pending: navigating, to: navigating ? pendingURL : null }),
		[navigating, pendingURL]
	)

	// render the component embedded in the necessary context so it can orchestrate
	// its needs
	return (
		<PendingURLContext.Provider value={pendingURL}>
		<NavigationContext.Provider value={navigation}>
		<LocationContext.Provider
			value={{
				pathname: currentURL,
				goto,
				params: variables ?? {},
				search,
			}}
		>
			<Is404Context.Provider value={is404}>
				{is404 ? (
					<NotFoundLayoutBoundary key={targetPage.id}>
						<PageComponent
							url={currentURL}
							showLoading={showFrame}
							key={targetPage.id + '__404'}
						/>
					</NotFoundLayoutBoundary>
				) : (
					<PageComponent
						url={currentURL}
						showLoading={showFrame}
						key={targetPage.id}
					/>
				)}
			</Is404Context.Provider>
		</LocationContext.Provider>
		</NavigationContext.Provider>
		</PendingURLContext.Provider>
	)
}

// useNavigation exposes the router's in-flight navigation. `pending` is true from the
// moment a navigation starts until the destination renders its actual content — it stays
// true while the destination's @loading state is showing — and `to` carries the
// destination url while pending (null when idle). This is the hook for global progress
// bars, per-link spinners, or disabling controls during a navigation.
export function useNavigation(): { pending: boolean; to: string | null } {
	return useContext(NavigationContext)
}

// internal accessor for the raw location context. the public surface is useRoute, which
// layers the per-route param/search types on top of this. not re-exported from the package
// index, so it isn't part of the public API.
export const useLocationContext = () => useContext(LocationContext)

export const ClientRedirect = ({ to }: { to: string }) => {
	const { goto } = useLocationContext()
	useEffect(() => {
		goto(to)
	}, [to])
	return null
}

/**
 * usePageData is responsible for kicking off the network requests necessary to render the page.
 * This includes loading the artifact, the component source, and any query results. This hook
 * only suspends if the component source is not available. The other cases are handled by the specific
 * page that is being rendered so that nested suspense boundaries are properly wired up.
 */
function usePageData({
	page,
	variables,
	assetPrefix: _assetPrefix,
	injectToStream,
}: {
	page: RouterPageManifest<ComponentType>
	variables: GraphQLVariables
	assetPrefix: string
	injectToStream: undefined | ((chunk: string) => void)
}): {
	loadData: (page: RouterPageManifest<ComponentType>, variables: {} | null) => void
	loadComponent: (page: RouterPageManifest<ComponentType>) => void
} {
	// grab context values
	const {
		client,
		cache,
		data_cache,
		component_cache,
		artifact_cache,
		ssr_signals,
		last_variables,
	} = useRouterContext()

	// grab the current session value
	const [session] = useSession()

	// the function to load a query using the cache references
	function load_query({
		id,
		artifact,
		variables,
	}: {
		id: string
		artifact: QueryArtifact
		variables: GraphQLVariables
	}): Promise<void> {
		// TODO: better tracking - only register the variables that were used
		// track the new variables
		for (const artifact of Object.keys(page.documents)) {
			last_variables.set(artifact, variables)
		}

		// TODO: AbortController on send()
		// TODO: we can read from cache here before making an asynchronous network call

		// if there is a pending request and we were asked to load, don't do anything
		if (ssr_signals.has(id)) {
			return ssr_signals.get(id)!
		}

		// send the request
		const observer: DocumentStore<GraphQLObject, GraphQLVariables> = data_cache.has(
			artifact.name
		)
			? data_cache.get(artifact.name)!
			: client.observe({ artifact, cache })

		// surface a query error to the client. an @loading query streams its result while the
		// document is still open, so on the initial SSR load the client is parked on the loading
		// frame waiting for this query's pending signal to resolve. unlike the success path the
		// store carries no data we can hydrate from the cache (errors aren't cache data), so we
		// stream the errors directly and rebuild an erroring store on the client. without this the
		// pending signal never resolves and the page hangs on the loading state instead of reaching
		// the nearest error boundary.
		function stream_error(errors: GraphQLError[]) {
			injectToStream?.(`
				<script>
				{
					const artifactName = ${escapeScriptTag(JSON.stringify(artifact.name))}
					const errors = ${escapeScriptTag(JSON.stringify(errors))}
					const variables = ${escapeScriptTag(JSON.stringify(observer.state.variables))}
					const artifact = ${escapeScriptTag(JSON.stringify(artifact))}

					// build a document store that already carries the errors so useQueryResult
					// throws to the nearest boundary the moment it reads the store
					const __houdini__error_store__ = (knownArtifact) => {
						const store = window.__houdini__client__.observe({
							artifact: knownArtifact ?? artifact,
							cache: window.__houdini__cache__,
							initialVariables: variables,
						})
						store.update((state) => ({ ...state, fetching: false, errors }))
						return store
					}

					// if the client has already hydrated (a client-side navigation to an @loading
					// route) push the error store straight into the live caches and release the signal
					if (window.__houdini__nav_caches__) {
						const caches = window.__houdini__nav_caches__
						caches.data_cache.set(
							artifactName,
							__houdini__error_store__(caches.artifact_cache.get(artifactName))
						)
						if (caches.ssr_signals.has(artifactName)) {
							caches.ssr_signals.get(artifactName).resolve()
							caches.ssr_signals.delete(artifactName)
						}
					} else {
						// otherwise the page module hasn't run yet (the common @loading case): stash the
						// error so hydrate_page can build the error store when it sets up the caches
						const pendingArtifacts = (window.__houdini__pending_artifacts__ =
							window.__houdini__pending_artifacts__ || {})
						pendingArtifacts[artifactName] = artifact
						const pendingVariables = (window.__houdini__pending_variables__ =
							window.__houdini__pending_variables__ || {})
						pendingVariables[artifactName] = variables
						const pendingErrors = (window.__houdini__pending_errors__ =
							window.__houdini__pending_errors__ || {})
						pendingErrors[artifactName] = errors
					}
				}
				</script>
			`)
		}

		// store the observer immediately so useQueryResult can access it
		// during SSR rendering before the fetch resolves
		let resolve: () => void = () => {}
		let reject: (message: string) => void = () => {}
		const promise = new Promise<void>((res, rej) => {
			resolve = res
			reject = rej

			observer
				.send({
					variables: variables,
					session,
				})
				.then(async () => {
					data_cache.set(id, observer)

					// if there is an error, stream it to the client (so an @loading query
					// reaches the error boundary instead of hanging on the loading state) and
					// clean up. on the client data_cache.set above is enough for useQueryResult
					// to read the errors and throw; the stream is what carries them across SSR.
					if (observer.state.errors && observer.state.errors.length > 0) {
						stream_error(observer.state.errors)
						ssr_signals.delete(id)
						resolve()
						return
					}

					// if we are building up a stream (on the server), we want to add something
					// to the client that resolves the pending request with the
					// data that we just got
					injectToStream?.(`
						<script>
						{
								// the resolved cache snapshot for this streamed query. when the bootstrap
								// module has already run (data arrived after hydration) we hydrate the live
								// cache directly; otherwise the module is still deferred (an @loading query
								// streams its data while the document is open) so we queue the snapshot for
								// hydrate_page to apply once it creates the cache. without this the snapshot
								// would be dropped and the query would hydrate with null data.
								const __houdini__snapshot__ = ${cache.serialize()}
								if (window.__houdini__cache__) {
									// hydrate into a fresh layer and merge it down, rather than clobbering the
									// shared hydration layer (which would drop everything hydrated before it)
									const __houdini__layer__ = window.__houdini__cache__.hydrate(__houdini__snapshot__)
									if (__houdini__layer__) {
										window.__houdini__cache__._internal_unstable.storage.resolveLayer(__houdini__layer__.id)
									}
								} else {
									(window.__houdini__pending_cache__ = window.__houdini__pending_cache__ || []).push(__houdini__snapshot__)
								}

								const artifactName = "${artifact.name}"
								const value = ${JSON.stringify(
									marshalSelection({
										selection: observer.artifact.selection,
										data: observer.state.data,
										config: getCurrentConfig(),
									})
								)}

								// if the data is pending, we need to resolve it
								if (window.__houdini__nav_caches__?.data_cache.has(artifactName)) {
									// before we resolve the pending signals,
									// fill the data cache with values we got on the server
									const new_store = window.__houdini__client__.observe({
										artifact: window.__houdini__nav_caches__.artifact_cache.get(artifactName),
										cache: window.__houdini__cache__,
									})

									// we're pushing this store onto the client, it should be initialized
									window.__houdini__nav_caches__.data_cache.get(artifactName).send({
										setup: true,
										variables: ${JSON.stringify(
											marshalInputs({
												artifact: observer.artifact,
												input: variables,
												config: configFile,
											})
										)}
									}).then(() => {
										window.__houdini__nav_caches__?.data_cache.set(artifactName, new_store)
									})

								}


								// if there are no data caches available we need to populate the pending one instead
								if (!window.__houdini__nav_caches__) {
									if (!window.__houdini__pending_data__) {
										window.__houdini__pending_data__ = {}
									}

									if (!window.__houdini__pending_variables__) {
										window.__houdini__pending_variables__ = {}
									}

									if (!window.__houdini__pending_artifacts__) {
										window.__houdini__pending_artifacts__ = {}
									}
								}

								window.__houdini__pending_variables__[artifactName] = ${JSON.stringify(observer.state.variables)}
								window.__houdini__pending_data__[artifactName] = value
								window.__houdini__pending_artifacts__[artifactName] = ${JSON.stringify(artifact)}

								// if this payload finishes off an ssr request, we need to resolve the signal
								if (window.__houdini__nav_caches__?.ssr_signals.has(artifactName)) {

									// if the data showed up on the client before
									if (window.__houdini__nav_caches__.data_cache.has(artifactName)) {
										// we're pushing this store onto the client, it should be initialized
										window.__houdini__nav_caches__.data_cache.get(artifactName).send({
											setup: true,
											variables: ${JSON.stringify(
												marshalInputs({
													artifact: observer.artifact,
													input: variables,
													config: configFile,
												})
											)}
										})
									}


									// trigger the signal
									window.__houdini__nav_caches__.ssr_signals.get(artifactName).resolve()
									window.__houdini__nav_caches__.ssr_signals.delete(artifactName)
								}
							}
						</script>
					`)

					ssr_signals.delete(id)
					resolve()
				})
				.catch((err) => {
					ssr_signals.delete(id)
					if (err?.name === 'AbortError') {
						return
					}
					// a thrown error (e.g. a throwOnError plugin) never lands in observer.state, so
					// seed it as a synthetic GraphQL error on the store and stream it to the client,
					// otherwise an @loading query that rejects hangs on the loading state
					const errors = [{ message: err?.message ?? String(err) }]
					observer.update((state) => ({ ...state, fetching: false, errors }))
					data_cache.set(id, observer)
					stream_error(errors)
					resolve()
				})
		})

		// register the pending signal on both client and server so that concurrent React renders
		// (concurrent mode / strict mode) that call load_query before data_cache is populated
		// find the existing signal and don't create a duplicate observer+send
		const resolvable = { ...promise, resolve, reject }
		ssr_signals.set(id, resolvable)

		// we're done
		return resolvable
	}

	// the function that loads all of the data for a page using the caches
	function loadData(
		targetPage: RouterPageManifest<ComponentType>,
		variables: GraphQLVariables | null
	) {
		if (!targetPage) {
			return
		}

		// if any of the artifacts that this page on have new variables, we need to clear the data cache
		for (const [artifact, { variables: pageVariables }] of Object.entries(
			targetPage.documents
		)) {
			// if there are no last variables, there's nothing to do
			if (!last_variables.has(artifact)) {
				continue
			}

			// compare the last known variables with the current set
			const last: GraphQLVariables = {}
			const usedVariables: GraphQLVariables = {}
			for (const variable of Object.keys(pageVariables)) {
				last[variable] = last_variables.get(artifact)![variable]
				usedVariables[variable] = variables?.[variable]
			}

			// before we can compare we need to only look at the variables that the artifact cares about
			if (Object.keys(usedVariables ?? {}).length > 0 && !deepEquals(last, usedVariables)) {
				data_cache.delete(artifact)
				ssr_signals.delete(artifact)
			}
		}

		// in order to avoid waterfalls, we need to kick off APIs requests in parallel
		// to use loading any missing artifacts or the page component.

		// group the necessary based on wether we have their artifact or not
		const missing_artifacts: string[] = []
		const found_artifacts: Record<string, QueryArtifact> = {}
		for (const key of Object.keys(targetPage.documents)) {
			if (artifact_cache.has(key)) {
				found_artifacts[key] = artifact_cache.get(key)!
			} else {
				missing_artifacts.push(key)
			}
		}

		// any missing artifacts need to be loaded and then have their queries loaded
		for (const artifact_id of missing_artifacts) {
			// load the artifact
			targetPage.documents[artifact_id]
				.artifact()
				.then((mod) => {
					// the artifact is the default export
					const artifact = mod.default

					// save the artifact in the cache
					artifact_cache.set(artifact_id, artifact)

					// now that we have the artifact, we can load the query too
					load_query({ id: artifact.name, artifact, variables })
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
				load_query({ id: artifact.name, artifact, variables })
			}
		}
	}

	async function loadComponent(targetPage: RouterPageManifest<ComponentType>) {
		if (component_cache.has(targetPage.id)) {
			return
		}
		const mod = await targetPage.component()
		component_cache.set(targetPage.id, mod.default)
	}

	// kick off requests for the current page
	loadData(page, variables)

	// if we haven't loaded the component yet, suspend and do so
	if (!component_cache.has(page.id)) {
		throw loadComponent(page)
	}

	return {
		loadData,
		loadComponent,
	}
}

export function RouterContextProvider({
	children,
	client,
	cache,
	artifact_cache,
	component_cache,
	data_cache,
	ssr_signals,
	last_variables,
	session: ssrSession = {},
	formResult = null,
	formToken = null,
}: {
	children: React.ReactNode
	client: HoudiniClient
	cache: Cache
	artifact_cache: SuspenseCache<QueryArtifact>
	component_cache: SuspenseCache<PageComponent>
	data_cache: SuspenseCache<DocumentStore<GraphQLObject, GraphQLVariables>>
	ssr_signals: PendingCache
	last_variables: LRUCache<GraphQLVariables>
	session?: App.Session
	formResult?: FormResult | null
	formToken?: string | null
}) {
	// the session is top level state
	// on the server, we can just use
	const [session, setSession] = React.useState<App.Session>(ssrSession)

	// if we detect an event that contains a new session value. The detail carries the subtree
	// and whether to merge it into the current session (an @session(merge:) upsert) or replace
	// it wholesale; a legacy plain-session detail is treated as a replace.
	const handleNewSession = React.useCallback((event: Event) => {
		const detail = (event as CustomEvent<HoudiniSessionEventDetail | App.Session>).detail
		const isWrapped =
			detail && typeof detail === 'object' && 'session' in detail && 'merge' in detail
		const next = (
			isWrapped ? (detail as HoudiniSessionEventDetail).session : detail
		) as App.Session
		const merge = isWrapped && (detail as HoudiniSessionEventDetail).merge

		// a new session invalidates every cached query result, exactly like updateSession():
		// navigation no longer clears the data cache, so without this an event-driven
		// session change (updateLocalSession) would keep serving results fetched under the
		// old session
		data_cache.clear()
		ssr_signals.clear()

		setSession((prev) => (merge ? { ...prev, ...next } : next))
	}, [data_cache, ssr_signals])

	React.useEffect(() => {
		window.addEventListener(HOUDINI_SESSION_EVENT, handleNewSession)

		// cleanup this component
		return () => {
			window.removeEventListener(HOUDINI_SESSION_EVENT, handleNewSession)
		}
	}, [handleNewSession])

	return (
		<Context.Provider
			value={{
				client,
				cache,
				artifact_cache,
				component_cache,
				data_cache,
				ssr_signals,
				last_variables,
				session,
				setSession: (newSession) => setSession((old) => ({ ...old, ...newSession })),
				replaceSession: (next) => setSession(next),
				clearSession: () => setSession({}),
				formResult,
				formToken,
			}}
		>
			{children}
		</Context.Provider>
	)
}

export type RouterContext = {
	client: HoudiniClient
	cache: Cache

	// We also need a cache for artifacts so that we can avoid suspending to
	// load them if possible.
	artifact_cache: SuspenseCache<QueryArtifact>

	// We also need a cache for component references so we can avoid suspending
	// when we load the same page multiple times
	component_cache: SuspenseCache<PageComponent>

	// Pages need a way to wait for data
	data_cache: SuspenseCache<DocumentStore<GraphQLObject, GraphQLVariables>>

	// A way to dedupe requests for a query
	ssr_signals: PendingCache

	// A way to track the last known good variables
	last_variables: LRUCache<GraphQLVariables>

	// The current session
	session: App.Session

	// a function to call that sets the client-side session singletone
	setSession: (newSession: Partial<App.Session>) => void

	// replace the client-side session wholesale (login establishes a fresh session). Local
	// state only — the cookie is set separately (the @session token relay / server form handler).
	replaceSession: (next: App.Session) => void

	// replace the client-side session with an empty one (logout); pairs with the server clear
	clearSession: () => void

	// the result of a no-JS form submission (keyed by form id), injected by the server on
	// the PRG error re-render so useMutationForm can seed its initial state inline.
	formResult: FormResult | null

	// the session-bound CSRF token forms render in their hidden field (always present from a
	// server render; null only when there is no server, e.g. a static export).
	formToken: string | null
}

// FormResult mirrors the server's injected shape: a no-JS submission's result keyed by
// form id (the mutation name, or an explicit useMutationForm({ id })).
export type FormResult = Record<string, { data: any; errors: any }>

export type PendingCache = SuspenseCache<
	Promise<void> & { resolve: () => void; reject: (message: string) => void }
>

export const useRouterContext = () => {
	const ctx = React.useContext(Context)

	if (!ctx) {
		throw new Error('Could not find router context')
	}

	return ctx
}

// useFormResult returns the server-injected result for a given form id, or null. The
// result is threaded through the router context on both render paths (the server passes it
// as a prop; the client hydration entry reads it from the streamed window global), so the
// enhanced form's initial state matches the no-JS re-rendered HTML.
export function useFormResult(formId: string): { data: any; errors: any } | null {
	return useRouterContext().formResult?.[formId] ?? null
}

// useFormToken returns the session-bound CSRF token to render in a form's hidden field, or
// null when there is no server render to mint it (e.g. a static export).
export function useFormToken(): string | null {
	return useRouterContext().formToken
}

export function useClient() {
	return useRouterContext().client
}

export function useCache() {
	return useRouterContext().cache
}

export function updateLocalSession(session: App.Session, merge = false) {
	window.dispatchEvent(
		new CustomEvent<HoudiniSessionEventDetail>(HOUDINI_SESSION_EVENT, {
			bubbles: true,
			detail: { session, merge },
		})
	)
}

export function useSession(): [
	App.Session,
	(newSession: Partial<App.Session> | null) => Promise<void>,
] {
	const ctx = useRouterContext()

	// updateSession does two things: (1) update the local client state, and (2) persist to the
	// session cookie through the always-on auth endpoint (Origin-gated, so a cross-origin page
	// can't forge a write). Pass a partial object to merge it into the session, or `null` to
	// log out — clearing the local session and deleting the cookie. It's awaitable so callers
	// can wait for the cookie to settle before navigating.
	const updateSession = async (newSession: Partial<App.Session> | null) => {
		// clear the data cache so that we refetch queries with the new session (will force a cache-lookup)
		ctx.data_cache.clear()
		ctx.ssr_signals.clear()

		if (newSession === null) {
			ctx.clearSession()
		} else {
			ctx.setSession(newSession)
		}

		await fetch(getAuthUrl(), {
			method: 'POST',
			body: JSON.stringify({ session: newSession }),
			headers: {
				'Content-Type': 'application/json',
				Accept: 'application/json',
			},
		})
	}

	return [ctx.session, updateSession]
}

export function useQueryResult<_Data extends GraphQLObject, _Input extends GraphQLVariables>(
	name: string
): [_Data | null, DocumentHandle<any, _Data, _Input>] {
	// pull the global context values
	const { data_cache, artifact_cache } = useRouterContext()
	const { pathname } = useLocationContext()
	const pendingURL = React.useContext(PendingURLContext)
	const last_store = React.useRef<DocumentStore<_Data, _Input> | null>(null)
	const [, bumpStore] = React.useReducer((n: number) => n + 1, 0)

	// Load the store reference. data_cache.get suspends when the store is missing — the
	// right behavior for a first render or for the navigation destination (a transition
	// waits on it, or the page's @loading boundary catches it). But the router evicts a
	// document mid-navigation to reload it with new variables, and a re-render of the
	// still-visible previous page must NOT re-suspend into its own loading state: it
	// keeps rendering from the store it already has, and the in-flight navigation swaps
	// the tree when the replacement resolves. "Previous page" = a render whose URL lags
	// the navigation target (pendingURL is lane-independent — see PendingURLContext).
	// The effect below is the safety net for a kept-stale commit that never gets swapped
	// (e.g. the navigation was superseded): it re-renders once a replacement store lands.
	const missing = !data_cache.has(name)
	const lagging = pendingURL !== null && pathname !== pendingURL
	const store_ref =
		missing && lagging && last_store.current
			? last_store.current
			: (data_cache.get(name)! as unknown as DocumentStore<_Data, _Input>)
	last_store.current = store_ref

	React.useEffect(() => {
		if (!missing) {
			return
		}
		let cancelled = false
		data_cache.waitFor(name).then(() => {
			if (!cancelled) {
				bumpStore()
			}
		})
		return () => {
			cancelled = true
		}
	}, [missing, name])

	// get the live data from the store
	const [storeValue, observer] = useDocumentStore<_Data, _Input>({
		artifact: store_ref.artifact,
		observer: store_ref,
	})

	// pull out the store values we care about
	const { data, errors } = storeValue

	// if there is an error in the response we need to throw to the nearest boundary
	if (errors && errors.length > 0) {
		throw new GraphQLErrors(errors)
	}
	// create the handle that we will use to interact with the store
	const handle = useDocumentHandle({
		artifact: artifact_cache.get(name)!,
		observer,
		storeValue,
	})

	// we're done
	return [data, handle]
}

function useLinkBehavior({
	goto,
	preload,
}: {
	goto: Goto
	preload: (url: string, which: PreloadWhichValue) => void
}) {
	// always use the click handler
	useLinkNavigation({ goto })

	// only use the preload handler if the browser hasn't chosen to reduce data usage
	// this doesn't break the rule of hooks because it will only ever have one value
	// in the lifetime of the app
	// @ts-expect-error
	if (!globalThis.navigator?.connection?.saveData) {
		// biome-ignore lint/correctness/useHookAtTopLevel: value is constant for the lifetime of the app
		usePreload({ preload })
	}
}

function useLinkNavigation({ goto }: { goto: Goto }) {
	React.useEffect(() => {
		const onClick: HTMLAnchorElement['onclick'] = (e) => {
			if (!e.target) {
				return
			}

			const link = (e.target as HTMLElement | null | undefined)?.closest('a')
			// its a link we want to handle so don't navigate like normal

			// we only want to capture a "normal click" ie something that indicates a route transition
			// in the current tab
			// courtesy of: https://gist.github.com/devongovett/919dc0f06585bd88af053562fd7c41b7
			if (
				!(
					link &&
					link instanceof HTMLAnchorElement &&
					link.href &&
					(!link.target || link.target === '_self') &&
					link.origin === location.origin &&
					!link.hasAttribute('download') &&
					e.button === 0 && // left clicks only
					!e.metaKey && // open in new tab (mac)
					!e.ctrlKey && // open in new tab (windows)
					!e.altKey && // download
					!e.shiftKey &&
					!e.defaultPrevented
				)
			) {
				return
			}

			// we need to figure out the target url by looking at the href attribute
			const target = link.attributes.getNamedItem('href')?.value
			// make sure its a link we recognize
			if (!target?.startsWith('/')) {
				return
			}

			// the session/auth endpoint and its sub-paths (e.g. the /login redirect-login entry) are
			// server endpoints, not client routes — let the browser navigate so the redirect flow runs
			if (target.startsWith(getAuthUrl())) {
				return
			}

			// its a link we want to handle so don't navigate like normal
			e.preventDefault()
			e.stopPropagation()

			// goto() runs the URL update in its own transition and tracks the pending
			// destination urgently. Don't wrap the call in another transition here: that
			// would drag the urgent bookkeeping (pendingURL) into the transition lane,
			// and the committed tree couldn't tell where the navigation is headed.
			goto(target)
		}

		window.addEventListener('click', onClick)
		return () => {
			window.removeEventListener('click', onClick!)
		}
	}, [goto])
}

function usePreload({ preload }: { preload: (url: string, which: PreloadWhichValue) => void }) {
	const timeoutRef: React.MutableRefObject<NodeJS.Timeout | null> = React.useRef(null)

	// if the mouse pauses on an element for 20ms then we register it as a hover
	// this avoids that annoying double tap on mobile when the click captures the hover
	React.useEffect(() => {
		const mouseMove: HTMLAnchorElement['onmousemove'] = (e) => {
			const target = e.target
			if (!(target instanceof HTMLElement)) {
				return
			}

			const anchor = target.closest('a')
			if (!anchor) {
				return
			}

			// if the anchor doesn't explicitly opt in to preloading, don't do anything
			const preloadAttr = anchor.attributes.getNamedItem('data-houdini-preload')
			if (!preloadAttr) {
				return
			}
			const preloadWhichRaw = preloadAttr.value
			const preloadWhich: PreloadWhichValue =
				!preloadWhichRaw || preloadWhichRaw === 'true'
					? 'page'
					: (preloadWhichRaw as PreloadWhichValue)

			// validate the preload option
			if (!PreloadWhich[preloadWhich]) {
				console.log(
					`invalid preload value "${preloadWhich}" must be "${PreloadWhich.component}", "${PreloadWhich.data}", or "${PreloadWhich.page}"`
				)
				return
			}

			// if we already have a timeout, remove it
			if (timeoutRef.current) {
				clearTimeout(timeoutRef.current)
			}

			// set the new timeout to track _this_ anchor
			timeoutRef.current = setTimeout(() => {
				const url = anchor.attributes.getNamedItem('href')?.value
				if (!url) {
					return
				}
				preload(url, preloadWhich)
			}, 20)
		}

		// register/cleanup the event handler
		document.addEventListener('mousemove', mouseMove)
		return () => {
			document.removeEventListener('mousemove', mouseMove)
		}
	}, [preload])
}

export type RouterCache = {
	artifact_cache: SuspenseCache<QueryArtifact>
	component_cache: SuspenseCache<PageComponent>
	data_cache: SuspenseCache<DocumentStore<GraphQLObject, GraphQLVariables>>
	last_variables: LRUCache<GraphQLVariables>
	ssr_signals: PendingCache
}

export function router_cache({
	pending_queries = [],
	artifacts = {},
	components = {},
	initialData = {},
	initialVariables = {},
	initialArtifacts = {},
}: {
	pending_queries?: string[]
	artifacts?: Record<string, QueryArtifact>
	components?: Record<string, PageComponent>
	initialData?: Record<string, DocumentStore<GraphQLObject, GraphQLVariables>>
	initialVariables?: Record<string, GraphQLVariables>
	initialArtifacts?: Record<string, QueryArtifact>
} = {}): RouterCache {
	const result: RouterCache = {
		artifact_cache: suspense_cache(initialArtifacts),
		component_cache: suspense_cache(),
		// observers accumulate across navigations now that goto doesn't clear the cache,
		// so the LRU capacity limit is reachable on long sessions. When it silently evicts
		// a store, let the store's plugins release whatever they hold.
		data_cache: suspense_cache(initialData, (store) => {
			store.cleanup()
		}),
		ssr_signals: suspense_cache(),
		last_variables: suspense_cache(),
	}

	// we need to fill each query with an externally resolvable promise
	for (const query of pending_queries) {
		result.ssr_signals.set(query, signal_promise())
	}

	for (const [name, artifact] of Object.entries(artifacts)) {
		result.artifact_cache.set(name, artifact)
	}

	for (const [name, component] of Object.entries(components)) {
		result.component_cache.set(name, component)
	}

	for (const [name, variables] of Object.entries(initialVariables)) {
		result.last_variables.set(name, variables)
	}

	return result
}

// Catches RoutingErrors that escape all HoudiniErrorBoundary instances during prefix-match
// (is404) rendering, preventing an infinite loop when a layout itself throws notFound().
class NotFoundLayoutBoundary extends React.Component<
	{ children: React.ReactNode },
	{ caught: boolean }
> {
	static contextType = StatusContext
	declare context: React.ContextType<typeof StatusContext>

	constructor(props: { children: React.ReactNode }) {
		super(props)
		this.state = { caught: false }
	}

	static getDerivedStateFromError(error: unknown) {
		if (error instanceof RoutingError) {
			return { caught: true }
		}
		return null
	}

	componentDidCatch(error: Error): void {
		if (error instanceof RoutingError && this.context) {
			this.context.status = error.status
		}
	}

	render() {
		if (this.state.caught) {
			return null
		}
		return this.props.children
	}
}

// re-exported (defined in ../contexts.js) so existing `routing` barrel consumers keep working
export { Is404Context }

export function NotFoundGate({ children }: { children: React.ReactNode }) {
	const is404 = React.useContext(Is404Context)
	if (is404) {
		throw new RoutingError(404)
	}
	return <>{children}</>
}

export function PageContextProvider({
	keys,
	children,
}: {
	keys: string[]
	children: React.ReactNode
}) {
	const location = useLocationContext()
	const params = Object.fromEntries(
		Object.entries(location.params).filter(([key]) => keys.includes(key))
	)

	return <PageContext.Provider value={{ params }}>{children}</PageContext.Provider>
}

// useRoute is the single hook for reading the current route: the route's params (scoped to
// this route's path segments) and search, both typed when a generated PageRoute/LayoutRoute
// is supplied, plus the current pathname and goto. This replaces the old useLocation —
// params/search live here rather than on the component props. Unlike a conventional
// useLocation it also carries params and goto, which is why it's named for the route.
export function useRoute<
	// the default leaves params/search empty (not a loose record) so that reading them
	// without passing the route's generated PageRoute type is a compile error, while
	// pathname and goto stay available for navigation-only code.
	_Route extends { params: any; search: any } = { params: {}; search: {} },
>(): {
	pathname: string
	params: _Route['params']
	search: _Route['search']
	goto: Goto
} {
	const location = useLocationContext()
	const route = useContext(PageContext)
	return {
		pathname: location.pathname,
		params: route.params as _Route['params'],
		search: location.search as _Route['search'],
		goto: location.goto,
	}
}

// A route shape for useRoute. A route's generated PageRoute/LayoutRoute already satisfies the
// `{ params; search }` shape, so the common case is useRoute<PageRoute>(). For a route-agnostic
// component (e.g. a reusable paginator that assumes its route exposes `after`/`first` search
// params) there's no single generated type to pass — use GenericRoute to type the axis you
// depend on and leave the other `never` (which falls back to a loose record). Search comes
// first since that's the usual reason to reach for it, so a search-only component writes
// GenericRoute<{ ... }> and a params-only one writes GenericRoute<never, { ... }>.
export type GenericRoute<Search = never, Params = never> = {
	params: [Params] extends [never] ? Record<string, any> : Params
	search: [Search] extends [never] ? Record<string, any> : Search
}

// a signal promise is a promise is used to send signals by having listeners attach
// actions to the then()
function signal_promise(): Promise<void> & { resolve: () => void; reject: () => void } {
	let resolve: () => void = () => {}
	let reject: () => void = () => {}
	const promise = new Promise<void>((res, rej) => {
		resolve = res
		reject = rej
	})

	return {
		...promise,
		resolve,
		reject,
	}
}
