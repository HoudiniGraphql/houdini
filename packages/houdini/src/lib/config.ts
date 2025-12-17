import * as graphql from 'graphql'
import type { GraphQLSchema } from 'graphql'
import minimatch from 'minimatch'

import { plugin_dir } from '../router/conventions.js'
import * as path from './path.js'
import type { PluginMeta } from './project.js'
import type { CachePolicies, PaginateModes } from './types.js'

declare namespace App {
	interface Session {}
}

// the values we can take in from the config file
export type ConfigFile = {
	/**
	 * A glob pointing to all files that houdini should consider. Note, this must include .js files
	 * for inline queries to work
	 * @default `src/** /*.{svelte,graphql,gql,ts,js}`
	 */
	include?: string | string[]

	/**
	 * A pattern used to remove matches from files that satisfy the include value
	 */
	exclude?: string | string[]

	/**
	 * A static representation of your schema
	 * @example path: `schema.graphql`
	 * @example glob: `src/** /*.graphql`
	 *
	 * FYI: `schemaPath` or `schema` should be defined
	 */
	schemaPath?: string

	/**
	 * An object describing custom scalars for your project. For more information: https://www.houdinigraphql.com/api/config#custom-scalars
	 */
	scalars?: ScalarMap

	/**
	 * A path that the generator will use to write schema.graphql and documents.gql files containing all of the internal fragment and directive definitions used in the project.
	 */
	definitionsPath?: string

	/**
	 * One of "esm" or "commonjs". Tells the artifact generator what kind of modules to create. (default: `esm`)
	 */
	module?: 'esm' | 'commonjs'

	/**
	 * The number of queries that must occur before a value is removed from the cache. For more information: https://www.houdinigraphql.com/guides/caching-data
	 */
	cacheBufferSize?: number

	/**
	 * The default cache policy to use for queries. For more information: https://www.houdinigraphql.com/guides/caching-data
	 */
	defaultCachePolicy?: CachePolicies

	/**
	 * Specifies whether or not the cache should always use partial data. For more information: https://www.houdinigraphql.com/guides/caching-data#partial-data
	 */
	defaultPartial?: boolean

	/**
	 * Specifies after how long a data goes stale in miliseconds. (default: `undefined`)
	 */
	defaultLifetime?: number

	/**
	 * Specifies whether mutations should append or prepend list. For more information: https://www.houdinigraphql.com/api/graphql (default: `append`)
	 */
	defaultListPosition?: 'append' | 'prepend'

	/**
	 * Specifies whether mutation should apply a specific target list. When you set `all`, it's like adding the directive `@allLists` to all _insert fragment (default: `null`)
	 */
	defaultListTarget?: 'all' | null

	/**
	 * Specifies whether the default paginate mode is Infinite or SinglePage. (default: `Infinite`)
	 */
	defaultPaginateMode?: PaginateModes

	/**
	 * Prevents the runtime from deduplicating pagination requests
	 */
	supressPaginationDeduplication?: boolean

	/**
	 * A list of fields to use when computing a record’s id. The default value is ['id']. For more information: https://www.houdinigraphql.com/guides/caching-data#custom-ids
	 */
	defaultKeys?: string[]

	/**
	 * An object that customizes the resolution behavior for a specific type. For more information: https://www.houdinigraphql.com/guides/caching-data#custom-ids
	 */
	types?: TypeConfig

	/**
	 * Specifies the style of logging houdini will use when generating your file. One of “quiet”, “full”, “summary”, or “short-summary”.
	 */

	logLevel?: string

	/**
	 * A flag to specify the default fragment masking behavior.
	 * @default `enable`
	 */
	defaultFragmentMasking?: 'enable' | 'disable'

	/**
	 * Configure the dev environment to watch a remote schema for changes
	 */
	watchSchema?: WatchSchemaConfig

	/**
	 * Specifies the the persisted queries path and file. (default: `<rootDir>/persisted_queries.json`)
	 */
	persistedQueriesPath?: string

	/**
	 * An object describing the plugins enabled for the project
	 */
	plugins?: HoudiniPluginConfig

	/**
	 * The relative path from your houdini config file pointing to your application.
	 * @default process.cwd()
	 */
	projectDir?: string

	/**
	 * The relative path from your project directory pointing to your output directory.
	 * @default `$houdini`
	 */
	runtimeDir?: string

	/**
	 * Configure the router
	 */
	router?: RouterConfig

	/**
	 * Configure the router to evaluate custom scalars using runtime values
	 */
	runtimeScalars?: Record<
		string,
		{
			// the equivalent GraphQL type
			type: string
			// the function to call that serializes the type for the API
			resolve: (args: RuntimeScalarPayload) => any
		}
	>
}

export type RuntimeScalarPayload = {
	// @ts-ignore
	session?: App.Session | null | undefined
}

type RouterConfig = {
	auth?: AuthStrategy
	apiEndpoint?: string
}

type AuthStrategy =
	| {
			redirect: string
			sessionKeys: string[]
			url?: string
	  }
	| {
			mutation: string
			sessionKeys: string[]
			url?: string
	  }

type ScalarMap = { [typeName: string]: ScalarSpec }

export type TypeConfig = {
	[typeName: string]: {
		keys?: string[]
		resolve?: {
			queryField: string
			arguments?: (data: any) => { [key: string]: any }
		}
	}
}

export type WatchSchemaConfig = {
	/**
	 * A url to use to pull the schema. For more information: https://www.houdinigraphql.com/api/cli#generate
	 */
	url: string | ((env: Record<string, string | undefined>) => string)

	/**
	 * sets the amount of time between each request in milliseconds (default 2 seconds).
	 * To limit the schema introspection to just on the start of the server, set interval to 0.
	 * To disable the schema introspection, set interval to null.
	 */
	interval?: number | null

	/**
	 * Sets a custom timeout in milliseconds which is used to cancel fetching the schema. If the timeout is reached
	 * before the remote API has responded, the request is cancelled and an error is displayed.
	 * The default is 30 seconds (30000 milliseconds)
	 */
	timeout?: number | null

	/**
	 * An object containing the environment variables you want passed onto the api when polling for a new schema.
	 * The keys dictate the header names. If the value is a string, the corresponding environment variable will be used
	 * directly. If the value is a function, the current environment will be passed to your function so you can perform any
	 * logic you need
	 */
	headers?:
		| Record<string, string | ((env: Record<string, string | undefined>) => string)>
		| ((env: Record<string, string | undefined>) => Record<string, string>)
}

export type ScalarSpec = {
	// the type to use at runtime
	type: string
	// the types that should be considered valid input types
	inputTypes?: Array<'Int' | 'Float' | 'String' | 'Boolean' | 'ID'>
	// the function to call that serializes the type for the API. If you are using this
	// scalar as the input to a query through a route parameter, this function will receive
	// the value as a string in addition to your complex value.
	marshal?: (val: any) => any
	// the function to call that turns the API's response into _ClientType
	unmarshal?: (val: any) => any
}

// this type is meant to be extended by plugins to provide type definitions
// for config
// @ts-ignore
export interface HoudiniPluginConfig {}

// this type is meant to be extended by client plugins to provide type definitions
// for config
// @ts-ignore
export interface HoudiniClientPluginConfig {}

// we need to include some extra meta data along with the config file
export class Config {
	public config_file: ConfigFile
	public filepath: string
	public plugins: PluginMeta[]
	public root_dir: string
	public schema: GraphQLSchema

	constructor(init: {
		config_file: ConfigFile
		filepath: string
		plugins: PluginMeta[]
		root_dir: string
		schema: GraphQLSchema
	}) {
		this.config_file = init.config_file
		this.filepath = init.filepath
		this.plugins = init.plugins
		this.root_dir = init.root_dir
		this.schema = init.schema
	}

	schema_path() {
		return this.config_file.schemaPath ?? path.resolve(process.cwd(), 'schema.json')
	}

	get localApiDir() {
		return path.join(this.root_dir, 'src', 'api')
	}

	async api_url() {
		const apiURL = this.config_file.watchSchema?.url
		if (!apiURL) {
			return ''
		}

		return this.process_env_values(process.env, apiURL)
	}

	get include(): Array<string> {
		// if the config file has one, use it
		if (this.config_file.include) {
			return Array.isArray(this.config_file.include)
				? this.config_file.include
				: [this.config_file.include]
		}

		// by default, any file of a valid extension in src is good enough
		const include = [`src/**/*`]

		// if any of the plugins specify included runtimes then their paths might have
		// documents
		for (const plugin of this.plugins) {
			const runtimeDir = path.join(plugin_dir(this, plugin.name), 'runtime')
			const staticDir = path.join(plugin_dir(this, plugin.name), 'static')

			// skip plugins that dont' include runtimes
			if (!runtimeDir && !staticDir) {
				continue
			}

			for (const dir of [runtimeDir, staticDir]) {
				if (!dir) {
					continue
				}

				// the include path is relative to root of the vite project
				const includePath = path.relative(this.root_dir, dir)

				// add the plugin's directory to the include pile
				include.push(`${includePath}/**/*`)
			}
		}

		return include
	}

	includeFile(
		filepath: string,
		{ root = this.root_dir }: { root?: string; ignore_plugins?: boolean } = {}
	) {
		const parsed = path.parse(filepath)
		filepath = `${parsed.dir}/${parsed.name}${parsed.ext.split('?')[0]}`

		let included = false
		// if the filepath doesn't match the include we're done
		if (
			!included &&
			!this.include.some((pattern) => minimatch(filepath, path.join(root, pattern)))
		) {
			return false
		}

		// if there is an exclude, make sure the path doesn't match any of the exclude patterns
		return !this.excludeFile(filepath, { root })
	}

	get exclude(): Array<string> {
		// if there is nothing specified we'll use an empty array
		if (!this.config_file.exclude) {
			return []
		}

		return Array.isArray(this.config_file.exclude)
			? this.config_file.exclude
			: [this.config_file.exclude]
	}

	excludeFile(filepath: string, { root = this.root_dir }: { root?: string }) {
		// if the configured exclude does not allow this file, we're done
		if (
			this.exclude.length > 0 &&
			this.exclude.some((pattern) => minimatch(filepath, path.join(root, pattern)))
		) {
			return true
		}

		// if we got this far, we shouldn't exclude
		return false
	}

	async schema_pull_headers() {
		const env = process.env

		// if the whole thing is a function, just call it
		const config_headers = this.config_file.watchSchema?.headers
		if (typeof config_headers === 'function') {
			return config_headers(env)
		}

		// we need to turn the map into the correct key/value pairs
		const headers = Object.fromEntries(
			Object.entries(config_headers || {})
				.map(([key, value]) => {
					const headerValue = this.process_env_values(env, value)

					// if there was no value, dont add anything
					if (!headerValue) {
						return []
					}

					return [key, headerValue]
				})
				.filter(([key]) => key)
		)

		// we're done
		return headers
	}

	process_env_values(
		env: Record<string, string | undefined>,
		value: string | ((env: any) => string)
	) {
		let headerValue: string | undefined
		if (typeof value === 'function') {
			headerValue = value(env)
		} else if (value.startsWith('env:')) {
			headerValue = env[value.slice('env:'.length)]
		} else {
			headerValue = value
		}

		return headerValue
	}

	get artifact_dir() {
		return path.join(this.root_dir, this.config_file.runtimeDir || '.houdini', 'artifacts')
	}

	get routes_dir() {
		return path.join(this.root_dir, 'src', 'routes')
	}

	// the location of the artifact generated corresponding to the provided documents
	artifactPath(document: graphql.DocumentNode): string {
		// use the operation name for the artifact
		return path.join(this.artifact_dir, `${documentName(document)}.js`)
	}

	pluginConfig<ConfigType extends {}>(name: string): ConfigType {
		// @ts-expect-error
		return (this.config_file.plugins?.[name] as ConfigType) ?? {}
	}
}

function documentName(document: graphql.DocumentNode) {
	// if there is an operation in the document
	const operation = document.definitions.find(
		({ kind }) => graphql.Kind.OPERATION_DEFINITION
	) as graphql.OperationDefinitionNode | null
	if (operation) {
		// if the operation does not have a name
		if (!operation.name) {
			// we can't give them a file
			throw new Error('encountered operation with no name: ' + graphql.print(document))
		}

		// use the operation name for the artifact
		return operation.name.value
	}

	// look for a fragment definition
	const fragmentDefinitions = document.definitions.filter(
		({ kind }) => kind === graphql.Kind.FRAGMENT_DEFINITION
	) as graphql.FragmentDefinitionNode[]
	if (fragmentDefinitions.length) {
		// join all of the fragment definitions into one
		return fragmentDefinitions.map((fragment) => fragment.name).join('_')
	}

	// we don't know how to generate a name for this document
	throw new Error('Could not generate artifact name for document: ' + graphql.print(document))
}
