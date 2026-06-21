import type { GraphQLObject, GraphQLVariables } from 'houdini/runtime'
import type { QueryArtifact } from 'houdini/runtime'
import type { Cache } from 'houdini/runtime/cache'
import type { DocumentStore, HoudiniClient } from 'houdini/runtime/client'
import { getCurrentConfig } from '$houdini/runtime'
import configFile from '$houdini/runtime/imports/config'
import { deepEquals } from 'houdini/runtime'
import type { LRUCache } from 'houdini/runtime'
import { marshalSelection, marshalInputs } from 'houdini/runtime'
import { find_match, find_prefix_match } from 'houdini/router/match'
import type { RouterManifest, RouterPageManifest } from 'houdini/router/types'
import React from 'react'
import { useContext, useEffect } from 'react'

import { buildHref, scalarUnmarshalers, unmarshalScalars } from '../resolve-href.js'
import type { Goto } from '../routes.js'
import { type DocumentHandle, useDocumentHandle } from '../hooks/useDocumentHandle.js'
import { useDocumentStore } from '../hooks/useDocumentStore.js'
import { type SuspenseCache, suspense_cache } from './cache.js'
import { GraphQLErrors, RoutingError, StatusContext } from './errors.js'

type PageComponent = React.ComponentType<{ url: string; children?: React.ReactNode }>

const PreloadWhich = {
	component: 'component',
	data: 'data',
	page: 'page',
} as const

type PreloadWhichValue = (typeof PreloadWhich)[keyof typeof PreloadWhich]
type ComponentType = any
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
	const { component_cache, data_cache, ssr_signals } = useRouterContext()
	const PageComponent = component_cache.get(targetPage.id)!

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
			setCurrentURL(window.location.pathname + window.location.search)
		}
		window.addEventListener('popstate', onChange)
		return () => {
			window.removeEventListener('popstate', onChange)
		}
	}, [])

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
						Object.values(manifest.pages).find((p) => p.url === target.to),
						getCurrentConfig()?.scalars,
						target.params,
						target.search
					)

		// clear the data cache so that we refetch queries with the new session (will force a cache-lookup)
		data_cache.clear()
		// clear pending signals so the next render starts fresh load_query calls
		ssr_signals.clear()

		// perform the navigation
		setCurrentURL(url)
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

	// TODO: cleanup navigation caches
	// render the component embedded in the necessary context so it can orchestrate
	// its needs
	return (
		<VariableContext.Provider value={variables}>
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
							<PageComponent url={currentURL} key={targetPage.id + '__404'} />
						</NotFoundLayoutBoundary>
					) : (
						<PageComponent url={currentURL} key={targetPage.id} />
					)}
				</Is404Context.Provider>
			</LocationContext.Provider>
		</VariableContext.Provider>
	)
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

					// if there is an error, signal completion (the error is visible via
					// useQueryResult reading observer.state.errors) and clean up
					if (observer.state.errors && observer.state.errors.length > 0) {
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
								window.__houdini__cache__?.hydrate(${cache.serialize()}, window.__houdini__hydration__layer__)

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
					reject(err)
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
}) {
	// the session is top level state
	// on the server, we can just use
	const [session, setSession] = React.useState<App.Session>(ssrSession)

	// if we detect an event that contains a new session value
	const handleNewSession = React.useCallback((event: Event) => {
		setSession((event as CustomEvent<App.Session>).detail)
	}, [])

	React.useEffect(() => {
		window.addEventListener('_houdini_session_', handleNewSession)

		// cleanup this component
		return () => {
			window.removeEventListener('_houdini_session_', handleNewSession)
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
}

export type PendingCache = SuspenseCache<
	Promise<void> & { resolve: () => void; reject: (message: string) => void }
>

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

export function updateLocalSession(session: App.Session) {
	window.dispatchEvent(
		new CustomEvent<App.Session>('_houdini_session_', {
			bubbles: true,
			detail: session,
		})
	)
}

export function useSession(): [App.Session, (newSession: Partial<App.Session>) => void] {
	const ctx = useRouterContext()

	// when we update the session we have to do 2 things. (1) we have to update the local state
	// that we will use on the client (2) we have to send a request to the server so that it
	// can update the cookie that we use for the session
	const updateSession = (newSession: Partial<App.Session>) => {
		// clear the data cache so that we refetch queries with the new session (will force a cache-lookup)
		ctx.data_cache.clear()
		ctx.ssr_signals.clear()

		// update the local state
		ctx.setSession(newSession)

		// figure out the url that we will use to send values to the server
		const auth = configFile.router?.auth
		if (!auth) {
			return
		}
		const url = 'redirect' in auth ? auth.redirect : auth.url

		fetch(url!, {
			method: 'POST',
			body: JSON.stringify(newSession),
			headers: {
				'Content-Type': 'application/json',
				Accept: 'application/json',
			},
		})
	}

	return [ctx.session, updateSession]
}

export function useCurrentVariables(): GraphQLVariables {
	return React.useContext(VariableContext)
}

const VariableContext = React.createContext<GraphQLVariables>(null)

const LocationContext = React.createContext<{
	pathname: string
	params: Record<string, any>
	// the parsed query string of the current url (declared search params coerced to
	// their scalar type, other keys raw; repeated keys are arrays).
	search: Record<string, any>
	// a function to imperatively navigate to a url
	goto: Goto
}>({
	pathname: '',
	params: {},
	search: {},
	goto: () => {},
})

export function useQueryResult<_Data extends GraphQLObject, _Input extends GraphQLVariables>(
	name: string
): [_Data | null, DocumentHandle<any, _Data, _Input>] {
	// pull the global context values
	const { data_cache, artifact_cache } = useRouterContext()

	// load the store reference (this will suspend)
	const store_ref = data_cache.get(name)! as unknown as DocumentStore<_Data, _Input>

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
	// navigations need to be registered as transitions
	const [_pending, startTransition] = React.useTransition()

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

			// its a link we want to handle so don't navigate like normal
			e.preventDefault()
			e.stopPropagation()

			// go to the next route as a low priority update
			startTransition(() => {
				goto(target)
			})
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
		data_cache: suspense_cache(initialData),
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

export const Is404Context = React.createContext(false)

export function NotFoundGate({ children }: { children: React.ReactNode }) {
	const is404 = React.useContext(Is404Context)
	if (is404) {
		throw new RoutingError(404)
	}
	return <>{children}</>
}

const PageContext = React.createContext<{ params: Record<string, any> }>({ params: {} })

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
