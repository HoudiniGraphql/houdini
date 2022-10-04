import { getMockConfig } from './test'
import { ConfigFile } from './types'

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
