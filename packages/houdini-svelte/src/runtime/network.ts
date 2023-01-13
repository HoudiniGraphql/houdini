import { HoudiniClient } from '$houdini/runtime/client'
import client from 'HOUDINI_CLIENT_PATH'

export function getCurrentClient(): HoudiniClient {
	// @ts-ignore
	return client
}
