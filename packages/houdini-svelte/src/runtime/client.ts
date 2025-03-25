import type { HoudiniClient } from '$houdini/runtime/client'
// @ts-ignore
import client from 'HOUDINI_CLIENT_PATH'

export function getClient(): HoudiniClient {
	if (!client) {
		throw new Error("client hasn't been initialized")
	}
	return client
}
