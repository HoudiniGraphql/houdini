import { Cache } from './cache'

let cache: Cache
try {
	// @ts-ignore: config will be defined by the generator
	cache = new Cache(config || {})
} catch {
	// @ts-ignore
	cache = new Cache({})
}

export default cache
