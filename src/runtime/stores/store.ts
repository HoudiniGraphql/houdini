import cache from '../cache'
import { getCurrentConfig } from '../lib/config'
import { ConfigFile } from '../lib/types'

export class BaseStore {
	async getConfig(): Promise<ConfigFile> {
		const config = await getCurrentConfig()

		// make sure the cache gets the reference
		cache.setConfig(config)

		return config
	}
}
