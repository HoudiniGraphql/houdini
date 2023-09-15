import type { Cache } from '$houdini/runtime/cache/cache'
import { DocumentStore, HoudiniClient } from '$houdini/runtime/client'
import { deepEquals } from '$houdini/runtime/lib/deepEquals'
import { LRUCache } from '$houdini/runtime/lib/lru'
import { GraphQLObject, GraphQLVariables } from '$houdini/runtime/lib/types'
import { QueryArtifact } from '$houdini/runtime/lib/types'
import React from 'react'
import { useStream } from 'react-streaming'

import { useDocumentStore } from '../../hooks/useDocumentStore'
import { SuspenseCache } from '../lib/cache'
import { find_match } from '../lib/match'
import type { RouterManifest, RouterPageManifest } from '../lib/types'

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
	loaded_queries,
	loaded_artifacts,
	assetPrefix,
}: {
	manifest: RouterManifest
	initialURL?: string
	loaded_queries?: Record<string, { data: GraphQLObject; variables: GraphQLVariables }>
	loaded_artifacts?: Record<string, QueryArtifact>
	assetPrefix: string
}) {
	// the current route is just a string in state.
	const [current, setCurrent] = React.useState(() => {
		return initialURL || window.location.pathname
	})

	// find the matching page for the current route
	const [page, variables] = find_match(manifest, current)

	// the only time this component will directly suspend (instead of one of its children)
	// is if we don't have the component source. Dependencies on query results or artifacts
	// will be resolved by the component itself

	// load the page assets (source, artifacts, data). this will suspend if the component is not available yet
	// this hook embeds pending requests in context so that the component can suspend if necessary14
	usePageData({ page, variables, loaded_queries, loaded_artifacts, assetPrefix })
	// if we get this far, it's safe to load the component
	const { component_cache } = useRouterContext()
	const PageComponent = component_cache.get(page.id)!

	//
	// Now that we know we aren't going to throw, let's set up the event listeners
	//

	// whenever the route changes, we need to make sure the browser's stack is up to date
	React.useEffect(() => {
		if (globalThis.window && window.location.pathname !== current) {
			window.history.pushState({}, '', current)
		}
	}, [current])

	// when we first mount we should start listening to the back button
	React.useEffect(() => {
		if (!globalThis.window) {
			return
		}
		const onChange = (evt: PopStateEvent) => {
			setCurrent(window.location.pathname)
		}
		window.addEventListener('popstate', onChange)
		return () => {
			window.removeEventListener('popstate', onChange)
		}
	}, [])

	// links are powered using anchor tags that we intercept and handle ourselves
	useAnchorIntercept({ goto: setCurrent })

	// TODO: cleanup navigation caches
	// render the component embedded in the necessary context so it can orchestrate
	// its needs
	return (
		<VariableContext.Provider value={variables}>
			<PageComponent url={current} />
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
	loaded_queries,
	loaded_artifacts,
	assetPrefix,
}: {
	page: RouterPageManifest
	variables: GraphQLVariables
	loaded_queries?: Record<string, { data: GraphQLObject; variables: GraphQLVariables }>
	loaded_artifacts?: Record<string, QueryArtifact>
	assetPrefix: string
}) {
	// grab context values
	const {
		client,
		cache,
		data_cache,
		component_cache,
		artifact_cache,
		pending_cache,
		last_variables,
	} = useRouterContext()

	// get a reference to the current stream
	const stream = useStream()

	// grab the current session value
	const session = useSession()

	// the function to load a query using the cache references
	function load_query({ id, artifact }: { id: string; artifact: QueryArtifact }): Promise<void> {
		// track the new variables
		last_variables.set(page.id, variables)

		// TODO: AbortController on send()
		// TODO: we can read from cache here before making an asynchronous network call

		// if there is a pending request and we were asked to load, don't do anything
		if (pending_cache.has(id)) {
			return pending_cache.get(id)!
		}

		// send the request
		const observer = client.observe({ artifact, cache })

		let resolve: () => void = () => {}
		let reject: () => void = () => {}
		const promise = new Promise<void>((res, rej) => {
			resolve = res
			reject = rej

			observer
				.send({
					variables: variables,
					cacheParams: { disableSubscriptions: true },
					session,
				})
				.then(() => {
					data_cache.set(id, observer)

					if (loaded_queries) {
						loaded_queries[artifact.name] = {
							data: observer.state.data!,
							variables,
						}
					}

					// if we are building up a stream (on the server), we want to add something
					// to the client that resolves the pending request with the
					// data that we just got
					stream?.injectToStream(`
						<script>
							window.__houdini__cache__?.hydrate(${cache.serialize()}, window.__houdini__hydration__layer)

							const artifactName = "${artifact.name}"
							const value = ${JSON.stringify(observer.state.data)}

							// if the data is pending, we need to resolve it
							if (window.__houdini__nav_caches__?.data_cache.has(artifactName)) {
								// before we resolve the pending signals,
								// fill the data cache with values we got on the server
								const new_store = window.__houdini__client__.observe({
									artifact: window.__houdini__nav_caches__.artifact_cache.get(artifactName),
									cache: window.__houdini__cache__,
									initialValue: value
								})

								window.__houdini__nav_caches__?.data_cache.set(artifactName, new_store)
							}


							// if there are no data caches available we need to populate the pending one instead
							if (!window.__houdini__nav_caches__) {
								if (!window.__houdini__pending_data__) {
									window.__houdini__pending_data__ = {}
								}

								if (!window.__houdini__pending_artifacts__) {
									window.__houdini__pending_artifacts__ = {}
								}

								window.__houdini__pending_data__[artifactName] = value
								window.__houdini__pending_artifacts__[artifactName] = ${JSON.stringify(artifact)}
							}

							if (window.__houdini__nav_caches__?.pending_cache.has(artifactName)) {
								// we're pushing this store onto the client, it should be initialized
								new_store.send({
									setup: true,
									variables: ${JSON.stringify(variables)}
								})

								// notify anyone waiting on the pending cache
								window.__houdini__nav_caches__.pending_cache.get(artifactName).resolve()
								window.__houdini__nav_caches__.pending_cache.delete(artifactName)
							}
						</script>
					`)

					resolve()
				})
				.catch(reject)
				// we're done processing
				.finally(() => {
					pending_cache.delete(id)
				})
		})

		// add it to the pending cache
		pending_cache.set(id, { ...promise, resolve, reject })

		// this promise is also what we want to do with the main invocation
		return pending_cache.get(id)!
	}

	// if the variables have changed then we need to clear the data store (so we fetch again)
	if (last_variables.has(page.id) && !deepEquals(last_variables.get(page.id), variables)) {
		data_cache.clear()
	}

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

	// any missing artifacts need to be loaded and then have their queries loaded
	for (const artifact_id of missing_artifacts) {
		// load the artifact
		page.documents[artifact_id]
			.artifact()
			.then((mod) => {
				// the artifact is the default export
				const artifact = mod.default

				// save the artifact in the cache
				artifact_cache.set(artifact_id, artifact)
				if (loaded_artifacts) {
					loaded_artifacts[artifact.name] = artifact
				}

				// add a script to load the artifact
				stream?.injectToStream(`
					<script type="module" src="${assetPrefix}/artifacts/${artifact.name}.js" async=""></script>
				`)

				// now that we have the artifact, we can load the query too
				load_query({ id: artifact.name, artifact })
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
			load_query({ id: artifact.name, artifact })
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

export function RouterContextProvider({
	children,
	client,
	cache,
	artifact_cache,
	component_cache,
	data_cache,
	pending_cache,
	last_variables,
	session: ssrSession = {},
}: {
	children: React.ReactElement
	client: HoudiniClient
	cache: Cache
	artifact_cache: SuspenseCache<QueryArtifact>
	component_cache: SuspenseCache<(props: any) => React.ReactElement>
	data_cache: SuspenseCache<DocumentStore<GraphQLObject, GraphQLVariables>>
	pending_cache: PendingCache
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
				pending_cache,
				last_variables,
				session,
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
	component_cache: SuspenseCache<(props: any) => React.ReactElement>

	// Pages need a way to wait for data
	data_cache: SuspenseCache<DocumentStore<GraphQLObject, GraphQLVariables>>

	// A way to dedupe requests for a query
	pending_cache: PendingCache

	// A way to track the last known good variables
	last_variables: LRUCache<GraphQLVariables>

	// The current session
	session: App.Session
}

export type PendingCache = SuspenseCache<
	Promise<void> & { resolve: () => void; reject: () => void }
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

export function useSession() {
	return useRouterContext().session
}

export function useCurrentVariables(): GraphQLVariables {
	return React.useContext(VariableContext)
}

const VariableContext = React.createContext<GraphQLVariables>(null)

export function useQueryResult<_Data extends GraphQLObject, _Input extends GraphQLVariables>(
	name: string
): [_Data | null, DocumentStore<_Data, _Input>] {
	const store_ref = useRouterContext().data_cache.get(name)! as unknown as DocumentStore<
		_Data,
		_Input
	>

	// get the live data from the store
	const [{ data }, observer] = useDocumentStore<_Data, _Input>({
		artifact: store_ref.artifact,
		observer: store_ref,
	})

	return [data, observer]
}

function useAnchorIntercept({ goto }: { goto: (url: string) => void }) {
	// navigations need to be registered as transitions
	const [pending, startTransition] = React.useTransition()

	React.useEffect(() => {
		let onClick: HTMLAnchorElement['onclick'] = (e) => {
			let link = (e.target as HTMLElement | null | undefined)?.closest('a')

			// we only want to capture a "normal click" ie something that indicates a route transition
			// in the current tab
			// courtesy of: https://gist.github.com/devongovett/919dc0f06585bd88af053562fd7c41b7
			if (
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
			) {
				// we need to figure out the target url by looking at the href attribute
				const target = link.attributes.getNamedItem('href')?.value
				// make sure its a link we recognize
				if (!target || !target.startsWith('/')) {
					return
				}

				// its a link we want to handle so don't navigate like normal
				e.preventDefault()

				// go to the next route as a low priority update
				startTransition(() => {
					goto(target)
				})
			}
		}

		document.addEventListener('click', onClick)
		return () => {
			document.removeEventListener('click', onClick!)
		}
	}, [])
}
