import type { Cache } from '$houdini/runtime/cache/cache'
import { DocumentStore, HoudiniClient } from '$houdini/runtime/client'
import configFile from '$houdini/runtime/imports/config'
import { deepEquals } from '$houdini/runtime/lib/deepEquals'
import type { LRUCache } from '$houdini/runtime/lib/lru'
import { marshalSelection, marshalInputs } from '$houdini/runtime/lib/scalars'
import type { GraphQLObject, GraphQLVariables } from '$houdini/runtime/lib/types'
import type { QueryArtifact } from '$houdini/runtime/lib/types'
import { find_match } from '$houdini/runtime/router/match'
import type { RouterManifest, RouterPageManifest } from '$houdini/runtime/router/types'
import React from 'react'
import { useContext } from 'react'

import { suspense_cache, type SuspenseCache } from './cache'

import { useDocumentHandle, type DocumentHandle } from '../hooks/useDocumentHandle'
import { useDocumentStore } from '../hooks/useDocumentStore'
import { Context, useRouterContext, useSession, useLocation, LocationContext, type PageComponent, type PendingCache } from './hooks'

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
		return initialURL || window.location.pathname
	})

	// find the matching page for the current route
	const [page, variables] = find_match(configFile, manifest, currentURL)
	// if we dont have a page, its a 404
	if (!page) {
		throw new Error('404')
	}

	// the only time this component will directly suspend (instead of one of its children)
	// is if we don't have the component source. Dependencies on query results or artifacts
	// will be resolved by the component itself

	// load the page assets (source, artifacts, data). this will suspend if the component is not available yet
	// this hook embeds pending requests in context so that the component can suspend if necessary14
	const { loadData, loadComponent } = usePageData({
		page,
		variables,
		assetPrefix,
		injectToStream,
	})
	// if we get this far, it's safe to load the component
	const { component_cache, data_cache } = useRouterContext()
	const PageComponent = component_cache.get(page.id)!

	// if we got this far then we're past suspense

	//
	// Now that we know we aren't going to throw, let's set up the event listeners
	//

	// whenever the route changes, we need to make sure the browser's stack is up to date
	React.useEffect(() => {
		if (globalThis.window && window.location.pathname !== currentURL) {
			window.history.pushState({}, '', currentURL)
		}
	}, [currentURL])

	// when we first mount we should start listening to the back button
	React.useEffect(() => {
		if (!globalThis.window) {
			return
		}
		const onChange = (evt: PopStateEvent) => {
			setCurrentURL(window.location.pathname)
		}
		window.addEventListener('popstate', onChange)
		return () => {
			window.removeEventListener('popstate', onChange)
		}
	}, [])

	// the function to call to navigate to a url
	const goto = (url: string) => {
		// clear the data cache so that we refetch queries with the new session (will force a cache-lookup)
		data_cache.clear()

		// perform the navigation
		setCurrentURL(url)
	}

	// links are powered using anchor tags that we intercept and handle ourselves
	useLinkBehavior({
		goto,
		preload(url: string, which: PreloadWhichValue) {
			// there are 2 things that we could preload: the page component and the data

			// look for the matching route information
			const [page, variables] = find_match(configFile, manifest, url)
			if (!page) {
				return
			}

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
				}}
			>
				<PageComponent url={currentURL} key={page.id} />
			</LocationContext.Provider>
		</VariableContext.Provider>
	)
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
	assetPrefix,
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
		const observer = data_cache.has(artifact.name)
			? data_cache.get(artifact.name)!
			: client.observe({ artifact, cache })

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

					// if there is an error, we need to reject the promise
					if (observer.state.errors && observer.state.errors.length > 0) {
						reject(observer.state.errors.map((e) => e.message).join('\n'))
						return
					}

					// if we are building up a stream (on the server), we want to add something
					// to the client that resolves the pending request with the
					// data that we just got
					injectToStream?.(`
						<script>
						{
								window.__houdini__cache__?.hydrate(${cache.serialize()}, window.__houdini__hydration__layer)

								const artifactName = "${artifact.name}"
								const value = ${JSON.stringify(
									marshalSelection({
										selection: observer.artifact.selection,
										data: observer.state.data,
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

					resolve()
				})
				.catch(reject)
		})

		// if we are on the server, we need to save a signal that we can use to
		// communicate with the client when we're done
		const resolvable = { ...promise, resolve, reject }
		if (!globalThis.window) {
			ssr_signals.set(id, resolvable)
		}

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
			let last: GraphQLVariables = {}
			let usedVariables: GraphQLVariables = {}
			for (const variable of Object.keys(pageVariables)) {
				last[variable] = last_variables.get(artifact)![variable]
				usedVariables[variable] = (variables ?? {})[variable]
			}

			// before we can compare we need to only look at the variables that the artifact cares about
			if (Object.keys(usedVariables ?? {}).length > 0 && !deepEquals(last, usedVariables)) {
				data_cache.delete(artifact)
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

					// add a script to load the artifact
					injectToStream?.(`
						<script type="module" src="${assetPrefix}/artifacts/${artifact.name}.js" async=""></script>
					`)

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

	// if we don't have the component then we need to load it, save it in the cache, and
	// then suspend with a promise that will resolve once its in cache
	async function loadComponent(targetPage: RouterPageManifest<ComponentType>) {
		// if we already have the component, don't do anything
		if (component_cache.has(targetPage.id)) {
			return
		}

		// load the component and then save it in the cache
		const mod = await targetPage.component()

		// save the component in the cache
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
	const handleNewSession = React.useCallback((event: CustomEvent<App.Session>) => {
		setSession(event.detail)
	}, [])

	React.useEffect(() => {
		// @ts-ignore
		window.addEventListener('_houdini_session_', handleNewSession)

		// cleanup this component
		return () => {
			// @ts-ignore
			window.removeEventListener('_houdini_session_', handleNewSession)
		}
	}, [])

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

export function updateLocalSession(session: App.Session) {
	window.dispatchEvent(
		new CustomEvent<App.Session>('_houdini_session_', {
			bubbles: true,
			detail: session,
		})
	)
}

export function useCurrentVariables(): GraphQLVariables {
    return React.useContext(VariableContext)
}

const VariableContext = React.createContext<GraphQLVariables>(null)

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
		throw new Error(JSON.stringify(errors))
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
	goto: (url: string) => void
	preload: (url: string, which: PreloadWhichValue) => void
}) {
	// always use the click handler
	useLinkNavigation({ goto })

	// only use the preload handler if the browser hasn't chosen to reduce data usage
	// this doesn't break the rule of hooks because it will only ever have one value
	// in the lifetime of the app
	// @ts-ignore
	if (!globalThis.navigator?.connection?.saveData) {
		usePreload({ preload })
	}
}

function useLinkNavigation({ goto }: { goto: (url: string) => void }) {
	// navigations need to be registered as transitions
	const [pending, startTransition] = React.useTransition()

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
			if (!target || !target.startsWith('/')) {
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
	}, [])
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

			// if the anchor doesn't allow for preloading, don't do anything
			let preloadWhichRaw = anchor.attributes.getNamedItem('data-houdini-preload')?.value
			let preloadWhich: PreloadWhichValue =
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
	}, [])
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

const PageContext = React.createContext<{ params: Record<string, any> }>({ params: {} })

export function PageContextProvider({
	keys,
	children,
}: {
	keys: string[]
	children: React.ReactNode
}) {
	const location = useLocation()
	const params = Object.fromEntries(
		Object.entries(location.params).filter(([key]) => keys.includes(key))
	)

	return <PageContext.Provider value={{ params }}>{children}</PageContext.Provider>
}

export function useRoute<PageProps extends { Params: {} }>(): RouteProp<PageProps['Params']> {
	return useContext(PageContext)
}

export type RouteProp<Params> = {
	params: Params
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
