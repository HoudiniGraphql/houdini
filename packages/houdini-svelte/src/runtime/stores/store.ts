import { getCache } from '$houdini/runtime'
import { getCurrentConfig } from '$houdini/runtime/lib/config'
import { ConfigFile } from '$houdini/runtime/lib/types'

export class BaseStore {
	async getConfig(): Promise<ConfigFile> {
		const config = await getCurrentConfig()

		// make sure the cache gets the reference
		getCache().setConfig(config)

		return config
	}
}
