import { Cache } from './cache'

// @ts-ignore: config will be defined by the generator
export default new Cache(config || {})

export function createCache() {
	// @ts-ignore: config will be defined by the generator
	return new Cache(config || {})
}
