// a suspense cache is an object that maintains a key-value store of
// objects. If a value is missing when get() is called, a promise
// is thrown that resolves when a value is passed to set()
import { LRUCache } from 'houdini/runtime'

export function suspense_cache<T>(
	initialData?: Record<string, T>,
	dispose?: (value: T) => void
): SuspenseCache<T> {
	const cache = new SuspenseCache<T>(dispose)

	for (const [key, value] of Object.entries(initialData ?? {})) {
		cache.set(key, value)
	}

	return cache
}

export class SuspenseCache<_Data> extends LRUCache<_Data> {
	// if get is called before set, we need to invoke a callback.
	// that means we need a place to put our callbacks
	#callbacks: Map<string, { resolve: () => void; reject: () => void }[]> = new Map()

	// called when a value is silently evicted by the LRU capacity limit so it can
	// release any resources it holds (e.g. a DocumentStore's plugin state). Explicit
	// delete()/clear() don't dispose: their values may still be rendered by a mounted
	// component that is about to re-suspend and receive a replacement.
	#dispose?: (value: _Data) => void

	constructor(dispose?: (value: _Data) => void) {
		super()
		this.#dispose = dispose
	}

	// bumped by clear() so async work started before an invalidation can tell its results
	// are stale (see load_query, which drops a completed send from a previous generation
	// instead of re-inserting data fetched under an old session)
	#generation = 0

	get generation(): number {
		return this.#generation
	}

	get(key: string): _Data {
		// if there is a value, use that
		if (super.has(key)) {
			return super.get(key)!
		}

		// we don't have a value, so we need to throw a promise
		// that resolves when a value is passed to set()
		throw this.waitFor(key)
	}

	// waitFor resolves when the key holds a value — immediately if it already does,
	// otherwise when set() is next called for it. The non-throwing counterpart to get()
	// for code that isn't rendering (so it can't suspend).
	waitFor(key: string): Promise<void> {
		if (super.has(key)) {
			return Promise.resolve()
		}
		return new Promise<void>((resolve, reject) => {
			this.#subscribe(key, resolve, reject)
		})
	}

	override clear() {
		super.clear()
		this.#generation++
		// deliberately NOT clearing #callbacks: a waitFor()/get() subscriber is waiting
		// for the key to hold a value, and after an invalidation the router refetches and
		// set()s it again — the pre-clear subscribers must resolve then (with the fresh
		// value) instead of hanging forever on a promise nothing can settle.
	}

	set(key: string, value: _Data) {
		// inserting a new key at capacity silently evicts the least-recently-used entry —
		// hand it to the dispose hook first so it can clean up after itself
		if (this.#dispose && !super.has(key) && this.size() >= this._capacity) {
			const oldest = this._map.keys().next()
			if (!oldest.done) {
				this.#dispose(this._map.get(oldest.value)!)
			}
		}

		// perform the set like normal
		super.set(key, value)

		// if there are subscribers, resolve them
		if (this.#callbacks.has(key)) {
			// resolve all of the callbacks
			this.#callbacks.get(key)?.forEach(({ resolve }) => {
				resolve()
			})
			// delete the key
			this.#callbacks.delete(key)
		}
	}

	#subscribe(key: string, resolve: () => void, reject: () => void) {
		this.#callbacks.set(key, [...(this.#callbacks.get(key) || []), { resolve, reject }])
	}
}
