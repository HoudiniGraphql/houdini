import type { GraphQLSchema } from 'graphql'

import config from '../imports/config'
import type { CachePolicy } from './types'

let mockConfig: ConfigFile | null = null

export function getMockConfig() {
	return mockConfig
}

export function setMockConfig(config: ConfigFile | null) {
	mockConfig = config
}

export function defaultConfigValues(file: ConfigFile): ConfigFile {
	return {
		defaultKeys: ['id'],
		...file,
		types: {
			Node: {
				keys: ['id'],
				resolve: {
					queryField: 'node',
					arguments: (node) => ({ id: node.id }),
				},
			},
			...file.types,
		},
	}
}

export function keyFieldsForType(configFile: ConfigFile, type: string) {
	return configFile.types?.[type]?.keys || configFile.defaultKeys!
}

export function computeID(configFile: ConfigFile, type: string, data: any): string {
	const fields = keyFieldsForType(configFile, type)

	let id = ''

	for (const field of fields) {
		id += data[field] + '__'
	}

	return id.slice(0, -2)
}

export function getCurrentConfig(): ConfigFile {
	const mockConfig = getMockConfig()
	if (mockConfig) {
		return mockConfig
	}

	return defaultConfigValues(config)
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
	 * Raw graphql schema
	 *
	 * FYI: `schemaPath` or `schema` should be defined
	 */
	schema?: string | GraphQLSchema

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
	defaultCachePolicy?: CachePolicy

	/**
	 * Specifies whether or not the cache should always use partial data. For more information: https://www.houdinigraphql.com/guides/caching-data#partial-data
	 */
	defaultPartial?: boolean

	/**
	 * Specifies whether mutations should append or prepend list. For more information: https://www.houdinigraphql.com/api/graphql (default: `append`)
	 */
	defaultListPosition?: 'append' | 'prepend'

	/**
	 * Specifies whether mutation should apply a specific target list. When you set `all`, it's like adding the directive `@allLists` to all _insert fragment (default: `null`)
	 */
	defaultListTarget?: 'all' | null

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
	 * An object describing the plugins enabled for the project
	 */
	plugins?: HoudiniPluginConfig

	/**
	 * The relative path from your houdini config file pointing to your application.
	 * @default process.cwd()
	 */
	projectDir?: string

	/**
	 * For now, the cache's imperative API is considered unstable. In order to suppress the warning,
	 * you must enable this flag.
	 */
	acceptImperativeInstability?: boolean
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
	 * sets the amount of time between each request in milliseconds (default 2 seconds).
	 * To limit the schema introspection to just on the start of the server, set interval to 0.
	 * To disable the schema introspection, set interval to null.
	 */
	interval?: number | null

	/**
	 * A url to use to pull the schema. For more information: https://www.houdinigraphql.com/api/cli#generate
	 */
	apiUrl?: string | ((env: Record<string, string | undefined>) => string)

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
	// the function to call that serializes the type for the API. If you are using this
	// scalar as the input to a query through a route parameter, this function will receive
	// the value as a string in addition to your complex value.
	marshal?: (val: any) => any
	// the function to call that turns the API's response into _ClientType
	unmarshal?: (val: any) => any
}

// this type is meant to be extended by plugins to provide type definitions
// for config
export interface HoudiniPluginConfig {}

// this type is meant to be extended by client plugins to provide type definitions
// for config
export interface HoudiniClientPluginConfig {}
