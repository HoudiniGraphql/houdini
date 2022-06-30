import { CachePolicy } from './types'
import type { GraphQLSchema } from 'graphql'

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
	sourceGlob: string
	schemaPath?: string
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
