import type { HoudiniClient } from '$houdini/runtime/client'
// @ts-ignore
import userClient from 'HOUDINI_CLIENT_PATH'

let client: HoudiniClient | null = null

export async function initClient(): Promise<HoudiniClient> {
	// if we have already initialized, don't do anything
	if (client) {
		return client
	}

	// @ts-ignore
	client = userClient
	return client!
}

export function getClient(): HoudiniClient {
	if (!client) {
		throw new Error("client hasn't been initialized")
	}
	return client
}
