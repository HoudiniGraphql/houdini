import { expect, test, vi } from 'vitest'

import { createLRUCache } from './lru'

test('evicts the least recently used entry past capacity', () => {
	const cache = createLRUCache<string>(2)
	cache.set('a', 'A')
	cache.set('b', 'B')
	cache.set('c', 'C')

	expect(cache.has('a')).toBe(false)
	expect(cache.get('b')).toBe('B')
	expect(cache.get('c')).toBe('C')
})

test('get refreshes recency', () => {
	const cache = createLRUCache<string>(2)
	cache.set('a', 'A')
	cache.set('b', 'B')
	// touch a so b becomes the least recently used
	cache.get('a')
	cache.set('c', 'C')

	expect(cache.has('a')).toBe(true)
	expect(cache.has('b')).toBe(false)
})

test('onEvict fires for capacity evictions with the evicted value', () => {
	const onEvict = vi.fn()
	const cache = createLRUCache<string>(2, onEvict)
	cache.set('a', 'A')
	cache.set('b', 'B')
	cache.set('c', 'C')

	expect(onEvict).toHaveBeenCalledTimes(1)
	expect(onEvict).toHaveBeenCalledWith('A', 'a')
})

test('onEvict fires for explicit deletes', () => {
	const onEvict = vi.fn()
	const cache = createLRUCache<string>(10, onEvict)
	cache.set('a', 'A')
	cache.delete('a')

	expect(onEvict).toHaveBeenCalledTimes(1)
	expect(onEvict).toHaveBeenCalledWith('A', 'a')

	// deleting a missing key does not fire
	cache.delete('missing')
	expect(onEvict).toHaveBeenCalledTimes(1)
})

test('onEvict fires when a key is overwritten with a different value', () => {
	const onEvict = vi.fn()
	const cache = createLRUCache<string>(10, onEvict)
	cache.set('a', 'A')
	cache.set('a', 'A2')

	expect(onEvict).toHaveBeenCalledTimes(1)
	expect(onEvict).toHaveBeenCalledWith('A', 'a')

	// re-setting the same value is an LRU touch, not an eviction
	cache.set('a', 'A2')
	expect(onEvict).toHaveBeenCalledTimes(1)
})

test('onEvict fires for every entry on clear', () => {
	const onEvict = vi.fn()
	const cache = createLRUCache<string>(10, onEvict)
	cache.set('a', 'A')
	cache.set('b', 'B')
	cache.clear()

	expect(onEvict).toHaveBeenCalledTimes(2)
	expect(onEvict).toHaveBeenCalledWith('A', 'a')
	expect(onEvict).toHaveBeenCalledWith('B', 'b')
	expect(cache.size()).toBe(0)
})
