/// <reference path="../../../../../houdini.d.ts" />
import cacheRef from '../cache'
import type { Cache } from '../cache/cache'
import { getCurrentConfig, localApiEndpoint } from '../lib'
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
	url?: string
	fetchParams?: FetchParamFn
	plugins?: NestedList<ClientPlugin>
	pipeline?: NestedList<ClientPlugin>
	throwOnError?: ThrowOnErrorParams
}

export type ObserveParams<
	_Data extends GraphQLObject,
	_Artifact extends DocumentArtifact = DocumentArtifact,
	_Input extends GraphQLVariables = GraphQLVariables
> = {
	artifact: _Artifact
	enableCache?: boolean
	cache?: Cache
	initialValue?: _Data | null
	initialVariables?: _Input
	fetching?: boolean
}

export class HoudiniClient {
	// the URL of the api
	url: string

	// expose operations settings
	readonly throwOnError_operations: ThrowOnErrorOperations[]

	private cache: Cache | null = null
	private throwOnError: ThrowOnErrorParams | undefined
	private fetchParams: FetchParamFn | undefined
	private pipeline: NestedList<ClientPlugin> | undefined
	private extraPlugins: NestedList<ClientPlugin> | undefined

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

	// we need the ability to link the client up with an external cache
	setCache(cache: Cache) {
		this.cache = cache
	}

	constructor({
		url,
		fetchParams,
		plugins,
		pipeline,
		throwOnError,
	}: HoudiniClientConstructorArgs = {}) {
		// if we were given plugins and pipeline there's an error
		if (plugins && pipeline) {
			throw new Error(
				'A client cannot be given a pipeline and a list of plugins at the same time.'
			)
		}

		this.throwOnError_operations = throwOnError?.operations ?? []

		let serverPort = globalThis.process?.env?.HOUDINI_PORT ?? '5173'

		// if there is no url provided then assume we are using the internal local api
		this.url =
			url ??
			(globalThis.window ? '' : `https://localhost:${serverPort}`) +
				localApiEndpoint(getCurrentConfig())

		this.throwOnError = throwOnError
		this.fetchParams = fetchParams
		this.pipeline = pipeline
		this.extraPlugins = plugins
	}

	get plugins(): ClientPlugin[] {
		return flatten(
			([] as NestedList<ClientPlugin>).concat(
				// if they specified a throw behavior
				this.throwOnError ? [throwOnErrorPlugin(this.throwOnError)] : [],
				fetchParamsPlugin(this.fetchParams),
				// if the user wants to specify the entire pipeline, let them do so
				this.pipeline ??
					// the user doesn't have a specific pipeline so we should just add their desired plugins
					// to the standard set
					(
						[
							// make sure that documents always work
							queryPlugin(this.cache ?? cacheRef),
							mutationPlugin(this.cache ?? cacheRef),
							fragmentPlugin(this.cache ?? cacheRef),
						] as NestedList<ClientPlugin>
					).concat(
						// add the specified middlewares
						this.extraPlugins ?? [],
						// and any middlewares we got from plugins
						pluginsFromPlugins,
						// if they provided a fetch function, use it as the body for the fetch middleware
						fetchPlugin()
					)
			)
		)
	}

	observe<_Data extends GraphQLObject, _Input extends GraphQLVariables>({
		enableCache = true,
		fetching = false,
		...rest
	}: ObserveParams<_Data, DocumentArtifact, _Input>): DocumentStore<_Data, _Input> {
		return new DocumentStore<_Data, _Input>({
			client: this,
			plugins: createPluginHooks(this.plugins),
			fetching,
			enableCache,
			cache: this.cache ?? undefined,
			...rest,
		})
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
