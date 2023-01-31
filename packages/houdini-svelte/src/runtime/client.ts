import type { HoudiniClient } from '$houdini/runtime/client'

let client: HoudiniClient | null = null

export async function initClient(): Promise<HoudiniClient> {
	// if we have already initialized, don't do anything
	if (client) {
		return client
	}

	// @ts-ignore
	client = (await import('HOUDINI_CLIENT_PATH')).default
	return client!
}

export function getClient(): HoudiniClient {
	if (!client) {
		throw new Error("client hasn't been initialized")
	}
	return client
}
