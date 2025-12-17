import type { ConfigFile } from 'houdini'

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
