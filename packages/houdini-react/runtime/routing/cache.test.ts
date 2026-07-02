import { describe, expect, test, vi } from 'vitest'

import { SuspenseCache, suspense_cache } from './cache.js'

describe('SuspenseCache', () => {
	test('get returns the value when present and throws a promise when missing', () => {
		const cache = new SuspenseCache<string>()
		cache.set('a', 'value')
		expect(cache.get('a')).toBe('value')

		let thrown: unknown
		try {
			cache.get('missing')
		} catch (err) {
			thrown = err
		}
		expect(thrown).toBeInstanceOf(Promise)
	})

	test('a thrown get() promise resolves when the key is set', async () => {
		const cache = new SuspenseCache<string>()
		let thrown: Promise<void> | undefined
		try {
			cache.get('a')
		} catch (err) {
			thrown = err as Promise<void>
		}

		cache.set('a', 'value')
		await expect(thrown).resolves.toBeUndefined()
	})

	test('waitFor resolves immediately when the key holds a value', async () => {
		const cache = new SuspenseCache<string>()
		cache.set('a', 'value')
		await expect(cache.waitFor('a')).resolves.toBeUndefined()
	})

	// the session-change-mid-navigation regression: an invalidation between subscribing
	// and the refetch landing must not orphan the subscriber (a pinned @loading skeleton)
	test('a waitFor subscriber created before clear() resolves when the key is set again', async () => {
		const cache = new SuspenseCache<string>()
		const pending = cache.waitFor('a')

		// invalidate before anything lands, then complete the refetch
		cache.clear()
		cache.set('a', 'fresh')

		await expect(pending).resolves.toBeUndefined()
		expect(cache.get('a')).toBe('fresh')
	})

	// load_query uses the generation to drop in-flight results that completed after an
	// invalidation instead of re-inserting data fetched under the old session
	test('clear() bumps the generation', () => {
		const cache = new SuspenseCache<string>()
		const before = cache.generation

		cache.clear()
		expect(cache.generation).toBe(before + 1)

		cache.clear()
		expect(cache.generation).toBe(before + 2)
	})

	test('set() and delete() leave the generation alone', () => {
		const cache = new SuspenseCache<string>()
		const before = cache.generation

		cache.set('a', 'value')
		cache.delete('a')
		expect(cache.generation).toBe(before)
	})

	describe('dispose', () => {
		test('called with the value evicted by the capacity limit', () => {
			const dispose = vi.fn()
			const cache = suspense_cache<string>({}, dispose)
			cache._capacity = 2

			cache.set('a', 'first')
			cache.set('b', 'second')
			expect(dispose).not.toHaveBeenCalled()

			// inserting a third entry evicts the least-recently-used one
			cache.set('c', 'third')
			expect(dispose).toHaveBeenCalledTimes(1)
			expect(dispose).toHaveBeenCalledWith('first')
			expect(cache.has('a')).toBe(false)
			expect(cache.get('b')).toBe('second')
			expect(cache.get('c')).toBe('third')
		})

		test('updating an existing key at capacity does not dispose anything', () => {
			const dispose = vi.fn()
			const cache = suspense_cache<string>({}, dispose)
			cache._capacity = 2

			cache.set('a', 'first')
			cache.set('b', 'second')
			cache.set('a', 'replaced')

			expect(dispose).not.toHaveBeenCalled()
			expect(cache.get('a')).toBe('replaced')
		})

		// delete()/clear() values may still be rendered by a mounted component that is
		// about to re-suspend and receive a replacement — they must not be disposed
		test('not called on delete() or clear()', () => {
			const dispose = vi.fn()
			const cache = suspense_cache<string>({}, dispose)

			cache.set('a', 'first')
			cache.delete('a')
			cache.set('b', 'second')
			cache.clear()

			expect(dispose).not.toHaveBeenCalled()
		})
	})
})
