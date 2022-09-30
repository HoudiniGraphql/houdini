import { getCache } from 'houdini/src/runtime'
import { getCurrentConfig } from 'houdini/src/runtime/lib/config'
import { ConfigFile } from 'houdini/src/runtime/lib/types'

export class BaseStore {
	async getConfig(): Promise<ConfigFile> {
		const config = await getCurrentConfig()

		// make sure the cache gets the reference
		getCache().setConfig(config)

		return config
	}
}
