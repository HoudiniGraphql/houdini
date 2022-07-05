import type { GraphQLSchema } from 'graphql'
import { CachePolicy } from './types'

export type ScalarSpec = {
	// the type to use at runtime
	type: string
	// the function to call that serializes the type for the API
	marshal: (val: any) => any
	// the function to call that turns the API's response into _ClientType
	unmarshal: (val: any) => any
}

type ScalarMap = { [typeName: string]: ScalarSpec }

// the values we can take in from the config file
export type ConfigFile = {
	/**
	 * A glob pointing at all your graphql operations
	 * @example glob: `src/** /*.{svelte,gql}`
	 */
	sourceGlob: string
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
	quiet?: boolean
	apiUrl?: string
	static?: boolean
	scalars?: ScalarMap
	definitionsPath?: string
	framework?: 'kit' | 'sapper' | 'svelte'
	module?: 'esm' | 'commonjs'
	cacheBufferSize?: number
	defaultCachePolicy?: CachePolicy
	defaultPartial?: boolean
	defaultKeys?: string[]
	types?: TypeConfig
	logLevel?: string
	disableMasking?: boolean
	/**
	 * A function to customize the logic houdini uses to identify a route vs a component
	 */
	isRoute?: (filepath: string) => boolean
	/**
	 * The path to your framework config file relative to the houdini config file. By
	 * default, Houdini will look for your framework config file in process.cwd()
	 * however that's not always valid. Use this option to customize where houdini looks.
	 */
	frameworkConfigFile?: string
	/**
	 * The directory containing your project routes. For default Kit and Sapper projects, this
	 * value is ./src/routes
	 */
	routesDir?: string
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
