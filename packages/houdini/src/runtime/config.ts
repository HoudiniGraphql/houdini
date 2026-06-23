import type { ConfigFile } from 'houdini'

// The reserved path the auth endpoint is mounted at when `router.auth.url` is not set. It is
// always available (the router mounts it regardless of auth config) so progressively-enhanced
// `@auth` forms work out of the box. Shared by the server (mint/verify) and the
// client (where useSession/useMutationForm POST the session token).
export const DEFAULT_AUTH_URL = '/__houdini__/auth'

// getAuthUrl resolves the session endpoint for a config — the configured override or the
// default — so the default lives in exactly one place across server and client.
export function getAuthUrl(config: ConfigFile): string {
	return config.router?.auth?.url ?? DEFAULT_AUTH_URL
}

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

// entityRefetchVariables derives the variables needed to look an entity up by id
// (e.g. { id: "..." } for a Node) from the entity's data. It powers both fragment
// pagination and @refetchable fragments, which embed the fragment in a query keyed
// by the entity. Mirrors the logic in Svelte's queryVariables().
export function entityRefetchVariables(
	configFile: ConfigFile,
	targetType: string | undefined | null,
	state: Record<string, any> | null | undefined
): Record<string, any> {
	if (!targetType || targetType === 'Query' || !state) {
		return {}
	}
	const config = defaultConfigValues(configFile)
	const typeConfig = config.types?.[targetType]
	if (typeConfig?.resolve?.arguments) {
		return (typeConfig.resolve.arguments(state) as Record<string, any>) ?? {}
	}
	const keys = keyFieldsForType(config, targetType)
	return Object.fromEntries(keys.map((key) => [key, state[key]]))
}

export function computeID(configFile: ConfigFile, type: string, data: any): string {
	const fields = keyFieldsForType(configFile, type)
	let id = ''

	for (const field of fields) {
		id += `${data[field]}__`
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
