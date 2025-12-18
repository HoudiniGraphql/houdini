import type { ConfigFile } from 'houdini'

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
	const withDefault = defaultConfigValues(configFile)
	return withDefault.types?.[type]?.keys || withDefault.defaultKeys!
}

export function computeID(configFile: ConfigFile, type: string, data: any): string {
	const fields = keyFieldsForType(configFile, type)
	let id = ''

	for (const field of fields) {
		id += data[field] + '__'
	}

	return id.slice(0, -2)
}

let _configFile: ConfigFile | null = null

export function getCurrentConfig(): ConfigFile {
	const mockConfig = getMockConfig()
	if (mockConfig) {
		return mockConfig
	}

	if (_configFile) {
		return _configFile
	}

	// For runtime, we need to return a default config if no config is available
	// This should normally be populated by the build process
	const defaultConfig = defaultConfigValues({})
	_configFile = defaultConfig
	return defaultConfig
}
