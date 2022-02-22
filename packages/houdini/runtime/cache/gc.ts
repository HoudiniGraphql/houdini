import { Cache } from './cache'

export class GarbageCollector {
	cache: Cache

	private lifetimes: Map<string, Map<string, number>> = new Map()

	// the number of ticks of the garbage collector that a piece of data will
	readonly cacheBufferSize: number

	constructor(cache: Cache, bufferSize: number = 10) {
		this.cache = cache
		this.cacheBufferSize = bufferSize
	}

	resetLifetime(id: string, field: string) {
		// if this is the first time we've seen the id
		if (!this.lifetimes.get(id)) {
			this.lifetimes.set(id, new Map())
		}

		// set the count to 0
		this.lifetimes.get(id)!.set(field, 0)
	}

	tick() {
		// look at every field of every record we know about
		for (const [id, fieldMap] of this.lifetimes.entries()) {
			for (const [field, lifetime] of fieldMap.entries()) {
				// if there is an active subscriber for the field move on
				if (this.cache._internal_unstable.subscriptions.get(id, field).length > 0) {
					continue
				}

				// there are no active subscriptions for this field, increment the lifetime count
				fieldMap.set(field, lifetime + 1)

				// if the lifetime is older than the maximum value, delete the value
				if (fieldMap.get(field)! > this.cacheBufferSize) {
					this.cache._internal_unstable.storage.deleteField(id, field)
				}
			}
		}
	}
}
