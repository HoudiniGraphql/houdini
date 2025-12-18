import type { Cache } from 'houdini/runtime/cache'
import { HoudiniClient as BaseClient, type ObserveParams } from 'houdini/runtime/client'
import { createPluginHooks } from 'houdini/runtime/client'
import { DocumentStore, type ClientPlugin } from 'houdini/runtime/documentStore'
import { flatten } from 'houdini/runtime/flatten'
import type {
	NestedList,
	DocumentArtifact,
	GraphQLObject,
	GraphQLVariables,
} from 'houdini/runtime/types'

import cacheRef from './cache'
import { getCurrentConfig, localApiEndpoint } from './config'
import type { FetchParamFn, ThrowOnErrorParams } from './plugins'
import {
	fetch as fetchPlugin,
	fetchParams as fetchParamsPlugin,
	fragment as fragmentPlugin,
	mutation as mutationPlugin,
	query as queryPlugin,
	throwOnError as throwOnErrorPlugin,
	optimisticKeys,
	cachePolicy,
} from './plugins'
import pluginsFromPlugins from './plugins/injectedPlugins'

// export the plugin constructors
export { fetch, mutation, query, subscription } from './plugins'
export { DocumentStore, type ClientPlugin, type SendParams } from 'houdini/runtime/documentStore'

export type HoudiniClientConstructorArgs = {
	url?: string
	fetchParams?: FetchParamFn
	plugins?: NestedList<ClientPlugin>
	pipeline?: NestedList<ClientPlugin>
	throwOnError?: ThrowOnErrorParams
	cache?: Cache
}

export class HoudiniClient extends BaseClient {
	// this is modified by page entries when they load in order to register the components source
	componentCache: Record<string, any> = {}

	// store cache configuration for use in document stores
	private _cache?: Cache
	private _enableCache: boolean = false

	// store throwOnError operations for access by stores
	throwOnError_operations: string[] = []

	constructor({
		url,
		fetchParams,
		plugins,
		pipeline,
		throwOnError,
		cache = cacheRef,
	}: HoudiniClientConstructorArgs = {}) {
		// if we were given plugins and pipeline there's an error
		if (plugins && pipeline) {
			throw new Error(
				'A client cannot be given a pipeline and a list of plugins at the same time.'
			)
		}

		let serverPort = globalThis.process?.env?.HOUDINI_PORT ?? '5173'

		super({
			config: getCurrentConfig,
			url:
				url ??
				(globalThis.window ? '' : `https://localhost:${serverPort}`) +
					localApiEndpoint(getCurrentConfig()),
			plugins: flatten(
				([] as NestedList<ClientPlugin>).concat(
					// if they specified a throw behavior
					throwOnError ? [throwOnErrorPlugin(throwOnError)] : [],
					fetchParamsPlugin(fetchParams),
					// if the user wants to specify the entire pipeline, let them do so
					pipeline ??
						// the user doesn't have a specific pipeline so we should just add their desired plugins
						// to the standard set
						(
							[
								optimisticKeys(cache ?? cacheRef),
								// make sure that documents always work
								queryPlugin(cache ?? cacheRef),
								mutationPlugin(cache ?? cacheRef),
								fragmentPlugin(cache ?? cacheRef),
							] as NestedList<ClientPlugin>
						).concat(
							// add the specified middlewares
							plugins ?? [],
							// and any middlewares we got from plugins
							pluginsFromPlugins,
							// if they provided a fetch function, use it as the body for the fetch middleware
							fetchPlugin()
						)
				)
			),
		})

		// Set cache properties after super call
		this._cache = cache
		this._enableCache = !!cache

		// Set throwOnError operations for access by stores
		this.throwOnError_operations = throwOnError?.operations ?? []
	}

	// Override observe to properly handle cachePolicy plugin
	observe<_Data extends GraphQLObject, _Input extends GraphQLVariables | undefined>({
		enableCache = true,
		fetching = false,
		...rest
	}: ObserveParams<_Data, DocumentArtifact, _Input>): DocumentStore<_Data, _Input> {
		// Create plugins with cachePolicy if cache is enabled
		const plugins: ClientPlugin[] = []

		// Add cachePolicy first if cache is enabled
		if (this._enableCache && enableCache) {
			// We need to create a placeholder for the setFetching callback
			// that will be set after the store is created
			let storeRef: DocumentStore<_Data, _Input> | null = null

			plugins.push(
				cachePolicy({
					cache: this._cache,
					enabled: true,
					setFetching: (fetching, data) => {
						if (storeRef) {
							storeRef.update((state) => {
								const newState = { ...state, fetching }

								// when we set the fetching state to true, we should also generate the appropriate
								// loading state for the document
								if (fetching && data) {
									newState.data = data
								}

								return newState
							})
						}
					},
				})
			)

			// Create the document store with the plugins
			const clientPlugins = (this.plugins as ClientPlugin[]).filter(
				(p): p is ClientPlugin => p !== null && typeof p === 'function'
			)
			const store = new DocumentStore<_Data, _Input>({
				client: this,
				plugins: createPluginHooks([...plugins, ...clientPlugins]),
				fetching,
				enableCache,
				config: this.config,
				...rest,
			})

			// Set the store reference for the setFetching callback
			storeRef = store

			return store
		} else {
			// No cache, use the base implementation
			const clientPlugins = (this.plugins as ClientPlugin[]).filter(
				(p): p is ClientPlugin => p !== null && typeof p === 'function'
			)
			return new DocumentStore<_Data, _Input>({
				client: this,
				plugins: createPluginHooks(clientPlugins),
				fetching,
				enableCache,
				config: this.config,
				...rest,
			})
		}
	}
}
