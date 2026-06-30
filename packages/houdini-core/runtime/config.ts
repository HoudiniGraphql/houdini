import type { ConfigFile } from 'houdini'
import { resolveApiEndpoint } from 'houdini/runtime'

import config from './imports/config.js'
import pluginConfigs from './imports/pluginConfig.js'

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
		id += `${data[field]}__`
	}

	return id.slice(0, -2)
}

// only compute the config file once
let _configFile: ConfigFile | null = null

// the GraphQL endpoint comes straight from the public config bundle (no injection): the remote
// `url`, the local mount `apiURL`, or the default — see resolveApiEndpoint.
export function localApiEndpoint() {
	return resolveApiEndpoint(getCurrentConfig())
}

export function getCurrentConfig(): ConfigFile {
	const mockConfig = getMockConfig()
	if (mockConfig) {
		return mockConfig
	}

	if (_configFile) {
		return _configFile
	}

	// we have to compute the config file. start with the default values
	// iterate over every plugin config value and merge the result
	let configFile = defaultConfigValues(config)
	for (const pluginConfig of pluginConfigs) {
		configFile = pluginConfig(configFile)
	}

	// save the result for later
	_configFile = configFile

	// we're done
	return configFile
}
