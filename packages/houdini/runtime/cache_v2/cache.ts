// external imports
import type { Config } from 'houdini-common'

/// Notes:
///
/// - a layer has to be completely cleared before values are resolved. if User:1 got a bunch of
///   values from the the layer but things resolved with User:2, we need to forget the User:1
///   values

class Cache {
	private _config: Config
	private cacheBufferSize: number = 10
	private _disabled: boolean = false

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
