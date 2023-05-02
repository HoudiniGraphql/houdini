/// <reference path="../../../../../houdini.d.ts" />
import { Cache } from '../cache/cache'
import { flatten } from '../lib/flatten'
import type { DocumentArtifact, GraphQLVariables, GraphQLObject, NestedList } from '../lib/types'
import type { ClientHooks, ClientPlugin } from './documentStore'
import { DocumentStore } from './documentStore'
import type { FetchParamFn, ThrowOnErrorOperations, ThrowOnErrorParams } from './plugins'
import {
	fetch as fetchPlugin,
	fetchParams as fetchParamsPlugin,
	fragment as fragmentPlugin,
	mutation as mutationPlugin,
	query as queryPlugin,
	throwOnError as throwOnErrorPlugin,
} from './plugins'
import pluginsFromPlugins from './plugins/injectedPlugins'

// export the plugin constructors
export { DocumentStore, type ClientPlugin, type SendParams } from './documentStore'
export { fetch, mutation, query, subscription } from './plugins'

export type HoudiniClientConstructorArgs = {
	url: string
	fetchParams?: FetchParamFn
	plugins?: NestedList<ClientPlugin>
	pipeline?: NestedList<ClientPlugin>
	throwOnError?: ThrowOnErrorParams
}

export type ObserveParams<
	_Data extends GraphQLObject,
	_Artifact extends DocumentArtifact = DocumentArtifact
> = {
	artifact: _Artifact
	enableCache?: boolean
	cache?: Cache
	initialValue?: _Data | null
	fetching?: boolean
}

export class HoudiniClient {
	// the URL of the api
	url: string

	// the list of plugins for the client
	readonly plugins: ClientPlugin[]

	// expose operations settings
	readonly throwOnError_operations: ThrowOnErrorOperations[]

	constructor({
		url,
		fetchParams,
		plugins,
		pipeline,
		throwOnError,
	}: HoudiniClientConstructorArgs) {
		// if we were given plugins and pipeline there's an error
		if (plugins && pipeline) {
			throw new Error(
				'A client cannot be given a pipeline and a list of plugins at the same time.'
			)
		}

		this.throwOnError_operations = throwOnError?.operations ?? []

		// a few middlewares _have_ to run to setup the pipeline
		this.plugins = flatten(
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
							// make sure that documents always work
							queryPlugin,
							mutationPlugin,
							fragmentPlugin,
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

		// save the state values
		this.url = url
	}

	observe<_Data extends GraphQLObject, _Input extends GraphQLVariables>({
		artifact,
		enableCache = true,
		initialValue,
		fetching = false,
		cache,
	}: ObserveParams<_Data>): DocumentStore<_Data, _Input> {
		return new DocumentStore({
			client: this,
			artifact,
			plugins: createPluginHooks(this.plugins),
			cache,
			enableCache,
			initialValue,
			fetching,
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
