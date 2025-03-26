import type { HoudiniClient } from '$houdini/runtime/client'

let client: HoudiniClient | null = null

export async function initClient(): Promise<HoudiniClient> {
	// if we have already initialized, don't do anything
	if (client) {
		return client
	}

	// @ts-ignore
	client = (await import('HOUDINI_CLIENT_PATH')).default

  // the import might not work immediately during hmr so patch init to ensure we wait until we get something
  const delay = (ms:number) => new Promise(res => setTimeout(res, ms))
  for (let retry = 0; retry < 10; retry++) {
    if (client) {
      break
    }

    await delay(100)
    // @ts-ignore
	  client = (await import('HOUDINI_CLIENT_PATH')).default
  }
	return client!
}

export function getClient(): HoudiniClient {
	if (!client) {
		throw new Error("client hasn't been initialized")
	}
	return client
}

