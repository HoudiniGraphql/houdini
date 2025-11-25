import { HoudiniClient as BaseClient } from 'houdini/runtime/client'
import type { ClientHooks, ClientPlugin } from 'houdini/runtime/documentStore'
import type {  NestedList } from 'houdini/runtime/types'
import type { Cache } from 'houdini/runtime/cache'

import cacheRef from './cache'
import { getCurrentConfig, localApiEndpoint } from './lib'
import { flatten } from './lib/flatten'
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
	proxies: Record<
		string,
		(operation: {
			query: string
			variables: any
			operationName: string
			session: App.Session | null | undefined
		}) => Promise<any>
	> = {}

	// this is modified by page entries when they load in order to register the components source
	componentCache: Record<string, any> = {}

  cache: Cache | null = null


	constructor({
		url,
		fetchParams,
		plugins,
		pipeline,
		throwOnError,
    cache,
	}: HoudiniClientConstructorArgs = {}) {
		// if we were given plugins and pipeline there's an error
		if (plugins && pipeline) {
			throw new Error(
				'A client cannot be given a pipeline and a list of plugins at the same time.'
			)
		}

		let serverPort = globalThis.process?.env?.HOUDINI_PORT ?? '5173'

    super({
      url: url ?? (globalThis.window ? '' : `https://localhost:${serverPort}`) +
				localApiEndpoint(getCurrentConfig()),
      plugins: flatten(
			([] as NestedList<ClientPlugin>).concat(
      // cache policy needs to always come first so that it can be the first network to fire
			cachePolicy({
				cache,
				enabled: enableCache,
				setFetching: (fetching, data) => {
					this.update((state) => {
						const newState = { ...state, fetching }

						// when we set the fetching state to true, we should also generate the appropriate
						// loading state for the document
						if (fetching && data) {
							newState.data = data
						}

						return newState
					})
				},
			})() as ClientHooks,

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
		)

    })

    this.cache = cache ?? null
	}

	registerProxy(
		url: string,
		handler: (operation: {
			query: string
			variables: any
			operationName: string
			session: App.Session | null | undefined
		}) => Promise<any>
	) {
		this.proxies[url] = handler
	}
}

// createPluginHooks instantiates the client plugins
export function createPluginHooks(plugins: ClientPlugin[]): ClientHooks[] {
	return plugins.reduce((hooks, plugin) => {
		if (typeof plugin !== 'function') {
			throw new Error("Encountered client plugin that's not a function")
		}

		// invoke the plugin
		const result = plugin()

		// ignore null results
		if (!result) {
			return hooks
		}

		// if we just have a single value, we're done
		if (!Array.isArray(result)) {
			return hooks.concat(result)
		}

		// add every value to the list
		for (const value of result) {
			// ignore any nulls
			if (!value) {
				continue
			}

			// if the result is a plugin, walk down
			if (typeof value === 'function') {
				return hooks.concat(createPluginHooks([value]))
			}

			// we know that value is a hook
			hooks.push(value)
		}

		return hooks
	}, [] as ClientHooks[])
}
