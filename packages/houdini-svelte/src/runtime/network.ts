import { HoudiniClient } from '$houdini/runtime/lib'

export async function getCurrentClient(): Promise<HoudiniClient> {
	// @ts-ignore
	return (await import('HOUDINI_CLIENT_PATH')).default
}
