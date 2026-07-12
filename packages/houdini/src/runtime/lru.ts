/**
 * This file is a copy and paste of a very simple and effective LRU cache
 * using javascript maps. It was copied under the MIT license found at the
 * bottom of the page.
 */

/**
 * JS maps (both plain objects and Map) maintain key insertion
 * order, which means there is an easy way to simulate LRU behavior
 * that should also perform quite well:
 *
 * To insert a new value, first delete the key from the inner _map,
 * then _map.set(k, v). By deleting and reinserting, you ensure that the
 * map sees the key as the last inserted key.
 *
 * Get does the same: if the key is present, delete and reinsert it.
 */
export class LRUCache<T> {
	_capacity: number
	_map: Map<string, T>
	// invoked whenever a value leaves the cache (capacity eviction, delete, overwrite,
	// clear) so owners of resources with teardown (subscriptions, stores) can dispose them
	_onEvict?: (value: T, key: string) => void

	constructor(capacity: number = 1000, onEvict?: (value: T, key: string) => void) {
		this._capacity = capacity
		this._map = new Map()
		this._onEvict = onEvict
	}

	set(key: string, value: T): void {
		// an overwrite with a different value evicts the old one (deleting and
		// reinserting the same value is just the LRU touch, not an eviction)
		const existing = this._map.get(key)
		this._map.delete(key)
		if (existing !== undefined && existing !== value) {
			this._onEvict?.(existing, key)
		}
		this._map.set(key, value)
		if (this._map.size > this._capacity) {
			const firstKey = this._map.keys().next()
			if (!firstKey.done) {
				const evicted = this._map.get(firstKey.value)
				this._map.delete(firstKey.value)
				if (evicted !== undefined) {
					this._onEvict?.(evicted, firstKey.value)
				}
			}
		}
	}

	get(key: string): T | null {
		const value = this._map.get(key)
		if (value != null) {
			this._map.delete(key)
			this._map.set(key, value)
		}
		return value ?? null
	}

	has(key: string): boolean {
		return this._map.has(key)
	}

	delete(key: string): void {
		const existing = this._map.get(key)
		this._map.delete(key)
		if (existing !== undefined) {
			this._onEvict?.(existing, key)
		}
	}

	size(): number {
		return this._map.size
	}

	capacity(): number {
		return this._capacity - this._map.size
	}

	clear(): void {
		const entries = [...this._map.entries()]
		this._map.clear()
		for (const [key, value] of entries) {
			this._onEvict?.(value, key)
		}
	}
}

export function createLRUCache<T>(
	capacity: number = 1000,
	onEvict?: (value: T, key: string) => void
): LRUCache<T> {
	return new LRUCache<T>(capacity, onEvict)
}

/**
MIT License

Copyright (c) Meta Platforms, Inc. and affiliates.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
 */
