/// <reference path="../../../../../houdini.d.ts" />
import type { DocumentArtifact, GraphQLObject } from '../lib/types'
import type { ClientPlugin } from './documentObserver'
import { DocumentObserver } from './documentObserver'
import {
	fetchParamsPlugin,
	fetchPlugin,
	mutationPlugin,
	queryPlugin,
	throwOnErrorPlugin,
	type FetchParamFn,
	type ThrowOnErrorParams,
} from './plugins'
import pluginsFromPlugins from './plugins/injectedPlugins'

// export the plugin constructors
export { DocumentObserver, type ClientPlugin } from './documentObserver'
export { fetchPlugin, mutationPlugin, queryPlugin, subscriptionPlugin } from './plugins'

type ConstructorArgs = {
	url: string
	fetchParams?: FetchParamFn
	plugins?: ClientPlugin[]
	pipeline?: ClientPlugin[]
	throwOnError?: ThrowOnErrorParams
}

export class HoudiniClient {
	// the URL of the api
	url: string

	// the list of plugins for the client
	#plugins: ClientPlugin[]

	constructor({ url, fetchParams, plugins, pipeline, throwOnError }: ConstructorArgs) {
		// if we were given plugins and pipeline there's an error
		if (plugins && pipeline) {
			throw new Error(
				'A client cannot be given a pipeline and a list of plugins at the same time.'
			)
		}

		// a few middlewares _have_ to run to setup the pipeline
		this.#plugins = ([] as ClientPlugin[]).concat(
			// if they specified a throw behavior
			throwOnError ? [throwOnErrorPlugin(throwOnError)] : [],
			fetchParamsPlugin(fetchParams),
			// if the user wants to specify the entire pipeline, let them do so
			pipeline ??
				// the user doesn't have a specific pipeline so we should just add their desired plugins
				// to the standard set
				[
					// make sure that queries and mutations always work
					queryPlugin,
					mutationPlugin,
				].concat(
					// add the specified middlewares
					plugins ?? [],
					// and any middlewares we got from plugins
					pluginsFromPlugins,
					// if they provided a fetch function, use it as the body for the fetch middleware
					fetchPlugin()
				)
		)

		// save the state values
		this.url = url
	}

	observe<_Data extends GraphQLObject, _Input extends Record<string, any>>({
		artifact,
		cache = true,
		initialValue,
		fetching = false,
	}: {
		artifact: DocumentArtifact
		cache?: boolean
		initialValue?: _Data | null
		fetching?: boolean
	}): DocumentObserver<_Data, _Input> {
		return new DocumentObserver({
			client: this,
			artifact,
			plugins: this.#plugins,
			cache,
			initialValue,
			fetching,
		})
	}
}
