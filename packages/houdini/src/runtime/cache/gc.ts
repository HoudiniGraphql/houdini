import type { Cache } from './cache'

export class GarbageCollector {
	cache: Cache

	private lifetimes: Map<string, Map<string, number>> = new Map()

	// the number of ticks of the garbage collector that a piece of data will
	get cacheBufferSize() {
		return this.cache._internal_unstable.config.cacheBufferSize ?? 10
	}

	constructor(cache: Cache) {
		this.cache = cache
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
		// get the current time of the tick
		const dt_tick = Date.now().valueOf()
		const config_max_time = this.cache._internal_unstable.config.defaultLifetime

		// look at every field of every record we know about
		for (const [id, fieldMap] of this.lifetimes.entries()) {
			for (const [field, lifetime] of fieldMap.entries()) {
				// if there is an active subscriber for the field move on
				if (this.cache._internal_unstable.subscriptions.get(id, field).length > 0) {
					continue
				}

				// --- ----------------- ---
				// --- Part 1 : lifetime ---
				// --- ----------------- ---
				// there are no active subscriptions for this field, increment the lifetime count
				fieldMap.set(field, lifetime + 1)

				// if the lifetime is older than the maximum value, delete the value
				if (fieldMap.get(field)! > this.cacheBufferSize) {
					this.cache._internal_unstable.storage.deleteField(id, field)
					// if there is a list associated with this field, the handler needs to be deleted
					this.cache._internal_unstable.lists.deleteField(id, field)

					// delete the entry in lifetime map
					fieldMap.delete(field)

					// if there are no more entries for the id, delete the id info
					if ([...fieldMap.keys()].length === 0) {
						this.lifetimes.delete(id)
					}

					// remove the field from the stale manager
					this.cache._internal_unstable.staleManager.delete(id, field)
				}

				// --- ------------------- ---
				// --- Part 2 : fieldTimes ---
				// --- ------------------- ---
				if (config_max_time && config_max_time > 0) {
					// if the field is older than x... mark it as stale
					const dt_valueOf = this.cache.getFieldTime(id, field)

					// if we have no dt_valueOf, it's already stale
					// check if more than the max time has passed since it was marked stale
					if (dt_valueOf && dt_tick - dt_valueOf > config_max_time) {
						this.cache._internal_unstable.staleManager.markFieldStale(id, field)
					}
				}
			}
		}
	}
}
