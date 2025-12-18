import type { ConfigFile } from 'houdini'

import type { Cache } from './cache'
import type { ClientHooks, ClientPlugin } from './documentStore.js'
import { DocumentStore } from './documentStore.js'
import type { DocumentArtifact, GraphQLVariables, GraphQLObject, NestedList } from './types'

// export the plugin constructors
export { DocumentStore } from './documentStore.js'
export type { ClientPlugin, SendParams } from './documentStore.js'

export type HoudiniClientConstructorArgs = {
	config: () => ConfigFile
	url?: string
	plugins?: NestedList<ClientPlugin>
	pipeline?: NestedList<ClientPlugin>
}

export type ObserveParams<
	_Data extends GraphQLObject,
	_Artifact extends DocumentArtifact = DocumentArtifact,
	_Input extends GraphQLVariables | undefined = GraphQLVariables
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

	protected cache: Cache | null = null
	protected plugins: Array<ClientPlugin> = []
	protected config: ConfigFile

	// this is modified by page entries when they load in order to register the components source
	componentCache: Record<string, any> = {}

	constructor(
		{ url, plugins, pipeline, config }: HoudiniClientConstructorArgs = {
			config: () => ({}),
		}
	) {
		// if we were given plugins and pipeline there's an error
		if (plugins && pipeline) {
			throw new Error(
				'A client cannot be given a pipeline and a list of plugins at the same time.'
			)
		}

		// if there is no url provided then assume we are using the internal local api
		const serverPort = globalThis.process?.env?.HOUDINI_PORT ?? '5173'
		this.url =
			url ??
			(globalThis.window ? '' : `http://localhost:${serverPort}`) + localApiEndpoint(config())

		this.plugins = flatten(plugins)
		this.config = config()
	}

	proxies: Record<
		string,
		(operation: {
			query: string
			variables: any
			operationName: string
			session: App.Session | null | undefined
		}) => Promise<any>
	> = {}

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

	observe<_Data extends GraphQLObject, _Input extends GraphQLVariables | undefined>({
		enableCache = true,
		fetching = false,
		...rest
	}: ObserveParams<_Data, DocumentArtifact, _Input>): DocumentStore<_Data, _Input> {
		console.log(this.config)
		return new DocumentStore<_Data, _Input>({
			client: this,
			plugins: createPluginHooks(this.plugins),
			fetching,
			enableCache,
			config: this.config,
			...rest,
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

// flatten processes a deeply nested lists of lists
function flatten<T>(source?: NestedList<T>): T[] {
	// if we dont have a list we're done
	if (!source) {
		return []
	}

	return source.reduce<T[]>((acc, element) => {
		// null values get ignored
		if (!element) {
			return acc
		}

		// if we found an array, flatten it
		if (Array.isArray(element)) {
			return acc.concat(flatten(element))
		}

		// if we found an element, add it to the parent
		return acc.concat(element)
	}, [])
}

function localApiEndpoint(configFile: ConfigFile) {
	return configFile.router?.apiEndpoint ?? '/_api'
}
