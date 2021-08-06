import { Cache } from './cache'

export function createCache() {
	// @ts-ignore: config will be defined by the generator
	return new Cache(config || {})
}
