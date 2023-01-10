/// <reference path="../../../../../houdini.d.ts" />
import { GraphQLObject, DocumentArtifact } from '../lib/types'
import { ClientPlugin, DocumentObserver } from './documentObserver'
import pluginsFromPlugins from './injectedPlugins'
import {
	queryPlugin,
	mutationPlugin,
	cachePolicyPlugin,
	fetchPlugin,
	fetchParamsPlugin,
	type FetchParamFn,
} from './plugins'

// export the plugin constructors
export { queryPlugin, mutationPlugin, fetchPlugin, subscriptionPlugin } from './plugins'

type ConstructorArgs = {
	url: string
	fetchParams?: FetchParamFn
	plugins?: ClientPlugin[]
	pipeline?: () => ClientPlugin[]
}

export class HoudiniClient {
	// the list of plugins for the client
	#plugins: ClientPlugin[]
	// the URL of the api
	url: string

	constructor(args: {
		url: string
		fetchParams?: FetchParamFn
		plugins?: ClientPlugin[]
		pipeline?: never
	})
	constructor(args: {
		url: string
		fetchParams?: FetchParamFn
		plugins?: never
		pipeline?: () => ClientPlugin[]
	})
	constructor({ url, fetchParams, plugins, pipeline }: ConstructorArgs) {
		// if we were given plugins and pipeline there's an error
		if (plugins && pipeline) {
			throw new Error(
				'A client cannot be given a pipeline and a list of plugins at the same time.'
			)
		}

		// a few middlewares _have_ to run to setup the API and then we
		// either have to add a totally custom pipeline specified by the pipeline value
		// or build up the default list
		this.#plugins = (fetchParams ? [fetchParamsPlugin(fetchParams)] : []).concat(
			[
				// cache policy needs to always come first so that it can be the first fetch_enter to fire
				cachePolicyPlugin,
			],
			// if the user wants to specify the entire pipeline, let them do so
			pipeline?.() ??
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

	observe(artifact: DocumentArtifact): DocumentObserver<GraphQLObject, {}> {
		return new DocumentObserver({ client: this, artifact, plugins: this.#plugins })
	}
}
