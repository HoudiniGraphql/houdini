import type { Cache } from 'houdini/runtime/cache'
import { HoudiniClient as BaseClient } from 'houdini/runtime/client'
import type { ClientHooks, ClientPlugin } from 'houdini/runtime/documentStore'
import type { NestedList } from 'houdini/runtime/types'
import { flatten } from 'houdini/runtime/flatten'

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
      config: getCurrentConfig,
			url:
				url ??
				(globalThis.window ? '' : `https://localhost:${serverPort}`) +
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
					})(),

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
