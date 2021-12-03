// external imports
import type { Config } from 'houdini-common'

class Cache {
	_config: Config

	constructor(config: Config) {
		this._config = config

		if (config.cacheBufferSize) {
			this.cacheBufferSize = config.cacheBufferSize
		}

		// the cache should always be disabled on the server
		try {
			this._disabled = typeof window === 'undefined'
		} catch {
			this._disabled = true
		}
	}
}
