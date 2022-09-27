import type { GraphQLSchema } from 'graphql'

import { getMockConfig } from './test'
import { CachePolicy } from './types'

export type ScalarSpec = {
	// the type to use at runtime
	type: string
	// the function to call that serializes the type for the API
	marshal?: (val: any) => any
	// the function to call that turns the API's response into _ClientType
	unmarshal?: (val: any) => any
}

type ScalarMap = { [typeName: string]: ScalarSpec }

// the values we can take in from the config file
export type ConfigFile = {
	/**
	 * A relative path from your houdini.config.js to the file that exports your client as its default value
	 */
	client: string

	/**
	 * @deprecated use include instead. although you might not need it at all, check the default value.
	 */
	sourceGlob?: string

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
	 * A url to use to pull the schema. For more information: https://www.houdinigraphql.com/api/cli#generate
	 */
	apiUrl?: string

	/**
	 * A boolean that tells the preprocessor to treat every component as a non-route. This is useful for projects built with the static-adapter
	 */
	static?: boolean

	/**
	 * An object describing custom scalars for your project. For more information: https://www.houdinigraphql.com/api/config#custom-scalars
	 */
	scalars?: ScalarMap

	/**
	 * A path that the generator will use to write schema.graphql and documents.gql files containing all of the internal fragment and directive definitions used in the project.
	 */
	definitionsPath?: string

	/**
	 * One of "kit" or "svelte". Used to tell the preprocessor what kind of loading paradigm to generate for you. (default: kit)
	 */
	framework?: 'kit' | 'svelte'

	/**
	 * One of "esm" or "commonjs". Tells the artifact generator what kind of modules to create. (default: esm)
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
	 * Specifies wether or not the cache should always use partial data. For more information: https://www.houdinigraphql.com/guides/caching-data#partial-data
	 */
	defaultPartial?: boolean

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
	 */
	disableMasking?: boolean

	/**
	 * Configures the houdini plugin's schema polling behavior. By default, houdini will poll your APIs
	 * during development in order to keep it's definition of your schema up to date. The schemaPollingInterval
	 * config value sets the amount of time between each request in milliseconds (default 2 seconds).
	 * To limit the schema introspection to just on the start of the server, set schemaPollingInterval to 0.
	 * To disable the schema introspection, set schemaPollingInterval to null.
	 */
	schemaPollInterval?: number | null

	/**
	 * An object containing the environment variables you want passed onto the api when polling for a new schema.
	 * The keys dictate the header names. If the value is a string, the corresponding environment variable will be used
	 * directly. If the value is a function, the current environment will be passed to your function so you can perform any
	 * logic you need
	 */
	schemaPollHeaders?: Record<string, string | ((env: NodeJS.ProcessEnv) => string)>

	/**
	 * The name of the file used to define page queries.
	 * @default +page.gql
	 */
	pageQueryFilename?: string

	/**
	 * The absolute path pointing to your SvelteKit project.
	 * @default process.cwd()
	 */
	projectDir?: string

	/**
	 * The default prefix of your global stores.
	 *
	 * _Note: it's nice to have a prefix so that your editor finds all your stores by just typings this prefix_
	 * @default GQL_
	 */
	globalStorePrefix?: string

	/**
	 * With this enabled, errors in your query will not be thrown as exceptions. You will have to handle
	 * error state in your route components or by hand in your load (or the onError hook)
	 */
	quietQueryErrors?: boolean
}

export type TypeConfig = {
	[typeName: string]: {
		keys?: string[]
		resolve: {
			queryField: string
			arguments?: (data: any) => { [key: string]: any }
		}
	}
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

export async function getCurrentConfig(): Promise<ConfigFile> {
	const mockConfig = getMockConfig()
	if (mockConfig) {
		return mockConfig
	}

	// @ts-ignore
	return defaultConfigValues((await import('HOUDINI_CONFIG_PATH')).default)
}
