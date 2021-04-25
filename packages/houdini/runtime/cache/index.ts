import { Cache } from './cache'

const localCache = new Cache()

// @ts-ignore
if (global.window) {
	// @ts-ignore
	window.cache = localCache
}

export default localCache
