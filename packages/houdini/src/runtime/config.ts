import type { ConfigFile } from 'houdini'

// The reserved path the auth endpoint is mounted at when `router.auth.url` is not set. It is
// always available (the router mounts it regardless of auth config) so progressively-enhanced
// `@session` forms work out of the box. Shared by the server (mint/verify) and the
// client (where useSession/useMutationForm POST the session token).
export const DEFAULT_AUTH_URL = '/__houdini__/auth'

// the resolved session endpoint, set once per process: server-side from the ServerConfigFile,
// client-side from the value the server injects at render (window.__houdini__auth_url__). The
// @session relay reads it via getAuthUrl() so the url never has to live in the client config
// bundle. Falls back to the default until set.
let _authUrl: string | undefined
export function setAuthUrl(url: string | undefined | null): void {
	_authUrl = url || undefined
}
export function getAuthUrl(): string {
	return _authUrl ?? DEFAULT_AUTH_URL
}

// the GraphQL endpoint, resolved the same way as the auth url: server-side from the
// ServerConfigFile, client-side from the value injected at render (window.__houdini__api_endpoint__).
// It lives in server config (not houdini.config) so it can be env-driven; the client reads the
// injected value. Falls back to '/_api'.
export const DEFAULT_API_ENDPOINT = '/_api'
let _apiEndpoint: string | undefined
export function setApiEndpoint(url: string | undefined | null): void {
	_apiEndpoint = url || undefined
}
export function getApiEndpoint(): string {
	return _apiEndpoint ?? DEFAULT_API_ENDPOINT
}

// The window event the session-relay plugin dispatches after an @session mutation so the
// router can mirror the write into local React state (no refresh). detail carries the session
// subtree and whether to merge it (vs replace). Shared so producer (core) and consumer
// (react router) can't drift.
export const HOUDINI_SESSION_EVENT = '_houdini_session_'
export type HoudiniSessionEventDetail = { session: App.Session; merge: boolean }

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
