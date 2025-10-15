// a suspense cache is an object that maintains a key-value store of
// objects. If a value is missing when get() is called, a promise
// is thrown that resolves when a value is passed to set()
import { LRUCache } from '$houdini/runtime/lib/lru'

export function suspense_cache<T>(initialData?: Record<string, T>): SuspenseCache<T> {
	const cache = new SuspenseCache<T>()

	for (const [key, value] of Object.entries(initialData ?? {})) {
		cache.set(key, value)
	}

	return cache
}

export class SuspenseCache<_Data> extends LRUCache<_Data> {
	// if get is called before set, we need to invoke a callback.
	// that means we need a place to put our callbacks
	#callbacks: Map<string, { resolve: () => void; reject: () => void }[]> = new Map()

	get(key: string): _Data {
		// if there is a value, use that
		if (super.has(key)) {
			return super.get(key)!
		}

		// we don't have a value, so we need to throw a promise
		// that resolves when a value is passed to set()
		throw new Promise<void>((resolve, reject) => {
			this.#subscribe(key, resolve, reject)
		})
	}

	// TODO: reject?

	set(key: string, value: _Data) {
		// perform the set like normal
		super.set(key, value)

		// if there are subscribers, resolve them
		if (this.#callbacks.has(key)) {
			// resolve all of the callbacks
			this.#callbacks.get(key)?.forEach(({ resolve }) => resolve())
			// delete the key
			this.#callbacks.delete(key)
		}
	}

	#subscribe(key: string, resolve: () => void, reject: () => void) {
		this.#callbacks.set(key, [...(this.#callbacks.get(key) || []), { resolve, reject }])
	}
}
