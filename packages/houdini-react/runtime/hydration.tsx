import React from 'react'
import { hydrateRoot, createRoot } from 'react-dom/client'
import type { QueryArtifact, GraphQLVariables } from '$houdini/runtime'
import type { Cache } from '$houdini/runtime/cache'
import type { HoudiniClient } from '$houdini/runtime/client'
import cacheRef from '$houdini/runtime/cache'
import { setAuthUrl, setApiEndpoint } from 'houdini/runtime'

import { injectComponents } from './componentFields.js'
import { router_cache, type RouterCache, type FormResult } from './routing/index.js'
import clientFactory from './client.js'

declare global {
	interface Window {
		__houdini__client__?: HoudiniClient
		__houdini__pending_components__?: Record<string, any>
		__houdini__cache__?: Cache
		__houdini__hydration__layer__?: any
		__houdini__initial__cache__?: any
		__houdini__initial__session__?: any
		__houdini__form_result__?: FormResult | null
		__houdini__form_token__?: string | null
		// the server-owned public endpoints, injected at render (see generate.go) — the session
		// endpoint the relay POSTs to and the GraphQL endpoint the client sends queries to
		__houdini__auth_url__?: string | null
		__houdini__api_endpoint__?: string | null
		__houdini__pending_artifacts__?: Record<string, QueryArtifact>
		__houdini__pending_data__?: Record<string, any>
		__houdini__pending_variables__?: Record<string, GraphQLVariables>
		__houdini__pending_cache__?: any[]
		__houdini__nav_caches__?: RouterCache
	}
}

export function hydrate_page(
	App: React.ComponentType<any>,
	Component: React.ComponentType<any>,
	pageName: string,
	pendingQueries: string[]
) {
	// publish the server-injected public endpoints BEFORE the client is constructed — the client's
	// url is resolved from getApiEndpoint() at construction, and the @session relay reads
	// getAuthUrl(). Neither lives in the client config bundle; they're injected at render.
	setAuthUrl(window.__houdini__auth_url__)
	setApiEndpoint(window.__houdini__api_endpoint__)

	// set up the client using its internally-managed singleton cache (cacheRef).
	// the client's cachePolicy and queryPlugin are closure-bound to cacheRef at
	// construction time, so we must use that same instance as window.__houdini__cache__
	// rather than creating a second cache and trying to wire them together afterward.
	window.__houdini__client__ ??= clientFactory()
	window.__houdini__cache__ ??= cacheRef

	// configure the singleton for React component field support
	if (window.__houdini__pending_components__) {
		window.__houdini__client__.componentCache = window.__houdini__pending_components__
	}
	window.__houdini__cache__._internal_unstable.componentCache =
		window.__houdini__client__.componentCache
	window.__houdini__cache__._internal_unstable.createComponent = (
		fn: React.ComponentType<any>,
		props: any
	) => React.createElement(fn, props)

	window.__houdini__hydration__layer__ ??=
		window.__houdini__cache__._internal_unstable.storage.createLayer()

	// rehydrate the cache from the server-serialized snapshot
	window.__houdini__cache__?.hydrate(
		window.__houdini__initial__cache__,
		window.__houdini__hydration__layer__
	)

	// apply any cache snapshots that streamed in before this module ran. an @loading query
	// resolves while the document is still open, so its resolution script runs before this
	// (deferred) module and couldn't hydrate the cache directly — it queued its snapshot here
	// instead. drain the queue now that the cache exists so the observers below read the
	// resolved data rather than the loading-state placeholder. each snapshot goes into its own
	// layer (hydrate() replaces a layer's contents wholesale, so reusing one would keep only
	// the last snapshot) and is then merged down so we end up with a single hydration layer.
	const storage = window.__houdini__cache__?._internal_unstable.storage
	for (const snapshot of window.__houdini__pending_cache__ ?? []) {
		const layer = window.__houdini__cache__?.hydrate(snapshot)
		if (layer && storage) {
			storage.resolveLayer(layer.id)
		}
	}
	window.__houdini__pending_cache__ = []

	// prime the data/artifact caches from anything the server streamed
	const initialData: Record<string, any> = {}
	const initialArtifacts: Record<string, QueryArtifact> = {}

	for (const [artifactName, artifact] of Object.entries(
		window.__houdini__pending_artifacts__ ?? {}
	)) {
		initialArtifacts[artifactName] = artifact

		if (window.__houdini__pending_data__?.[artifactName]) {
			const variables = window.__houdini__pending_variables__![artifactName]

			if ((artifact as any).hasComponents) {
				injectComponents({
					cache: window.__houdini__cache__!,
					selection: (artifact as any).selection,
					data: window.__houdini__pending_data__[artifactName],
					variables,
				})
			}

			const observer = window.__houdini__client__!.observe({
				artifact,
				cache: window.__houdini__cache__,
				initialValue: window.__houdini__cache__!.read({
					selection: (artifact as any).selection,
					variables,
				}).data,
				initialVariables: variables,
			})

			observer.send({
				setup: true,
				variables,
				session: window.__houdini__initial__session__,
			})

			initialData[artifactName] = observer
		}
	}

	if (!window.__houdini__nav_caches__) {
		window.__houdini__nav_caches__ = router_cache({
			pending_queries: pendingQueries,
			initialData,
			initialVariables: window.__houdini__pending_variables__,
			initialArtifacts,
			components: { [pageName]: Component },
		})
		_flush_pending_artifacts()
	}

	hydrateRoot(
		document,
		<App
			initialURL={window.location.pathname + window.location.search}
			cache={window.__houdini__cache__}
			session={window.__houdini__initial__session__}
			formResult={window.__houdini__form_result__}
			formToken={window.__houdini__form_token__}
			{...window.__houdini__nav_caches__}
		/>
	)
}

const _pendingArtifacts: Array<[string, QueryArtifact]> = []

export function register_artifact(name: string, artifact: QueryArtifact) {
	const caches = window.__houdini__nav_caches__
	if (!caches?.artifact_cache) {
		_pendingArtifacts.push([name, artifact])
		return
	}
	if (!caches.artifact_cache.has(name)) {
		caches.artifact_cache.set(name, artifact)
	}
}

function _flush_pending_artifacts() {
	while (_pendingArtifacts.length > 0) {
		const [name, artifact] = _pendingArtifacts.shift()!
		register_artifact(name, artifact)
	}
}

export function mount_static_app(App: React.ComponentType<any>, manifest: any) {
	const root = createRoot(document.getElementById('app')!)

	root.render(
		React.createElement(App, {
			initialURL: window.location.pathname + window.location.search,
			cache: cacheRef,
			session: null,
			manifest,
			...router_cache(),
		})
	)
}
