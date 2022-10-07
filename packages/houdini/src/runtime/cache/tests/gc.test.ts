import { test, vi, expect } from 'vitest'

import { testConfigFile } from '../../../test'
import { Cache } from '../cache'

const config = testConfigFile()
config.cacheBufferSize! = 10

test('adequate ticks of garbage collector clear unsubscribed data', function () {
	const cache = new Cache(config)

	const userFields = {
		id: {
			type: 'ID',
			keyRaw: 'id',
		},
		firstName: {
			type: 'String',
			keyRaw: 'firstName',
		},
	}

	cache.write({
		selection: {
			viewer: {
				type: 'User',
				keyRaw: 'viewer',
				fields: userFields,
			},
		},
		data: {
			viewer: {
				id: '1',
				firstName: 'bob',
			},
		},
	})

	// tick the garbage collector enough times to fill up the buffer size
	for (const _ of Array.from({ length: config.cacheBufferSize! })) {
		cache._internal_unstable.collectGarbage()
		expect(cache.read({ selection: userFields, parent: 'User:1' })).toMatchObject({
			data: { id: '1' },
		})
	}

	// collecting garbage one more time should delete the record from the cache
	cache._internal_unstable.collectGarbage()
	expect(cache.read({ selection: userFields, parent: 'User:1' })).toMatchObject({
		data: null,
	})
})

test("subscribed data shouldn't be garbage collected", function () {
	const cache = new Cache(testConfigFile())

	cache.write({
		selection: {
			viewer: {
				type: 'User',
				keyRaw: 'viewer',
				fields: {
					id: {
						type: 'ID',
						keyRaw: 'id',
					},
					firstName: {
						type: 'String',
						keyRaw: 'firstName',
					},
				},
			},
		},
		data: {
			viewer: {
				id: '1',
				firstName: 'bob',
			},
		},
	})

	// subscribe to the fields
	cache.subscribe({
		rootType: 'Query',
		selection: {
			viewer: {
				type: 'User',
				keyRaw: 'viewer',
				fields: {
					id: {
						type: 'ID',
						keyRaw: 'id',
					},
				},
			},
		},
		set: vi.fn(),
	})

	// tick the garbage collector enough times to fill up the buffer size
	for (const _ of Array.from({ length: config.cacheBufferSize! + 1 })) {
		cache._internal_unstable.collectGarbage()
	}

	expect(
		cache.read({
			selection: {
				id: {
					type: 'ID',
					keyRaw: 'id',
				},
			},
			parent: 'User:1',
		}).data
	).toEqual({ id: '1' })
})

test('resubscribing to fields marked for garbage collection resets counter', function () {
	const cache = new Cache(testConfigFile())

	cache.write({
		selection: {
			viewer: {
				type: 'User',
				keyRaw: 'viewer',
				fields: {
					id: {
						type: 'ID',
						keyRaw: 'id',
					},
					firstName: {
						type: 'String',
						keyRaw: 'firstName',
					},
				},
			},
		},
		data: {
			viewer: {
				id: '1',
				firstName: 'bob',
			},
		},
	})

	// tick the gc 3 times
	for (const _ of Array.from({ length: 3 })) {
		cache._internal_unstable.collectGarbage()
	}

	const set = vi.fn()

	// subscribe to the fields
	cache.subscribe({
		rootType: 'Query',
		selection: {
			viewer: {
				type: 'User',
				keyRaw: 'viewer',
				fields: {
					id: {
						type: 'ID',
						keyRaw: 'id',
					},
				},
			},
		},
		set,
	})

	// tick the garbage collector enough times to fill up the buffer size
	for (const _ of Array.from({ length: config.cacheBufferSize! })) {
		cache._internal_unstable.collectGarbage()
	}

	// subscribe to the fields
	cache.unsubscribe({
		rootType: 'Query',
		selection: {
			viewer: {
				type: 'User',
				keyRaw: 'viewer',
				fields: {
					id: {
						type: 'ID',
						keyRaw: 'id',
					},
				},
			},
		},
		set,
	})

	// tick the garbage collector enough times to fill up the buffer size
	for (const _ of Array.from({ length: config.cacheBufferSize! })) {
		cache._internal_unstable.collectGarbage()
	}

	// make sure we still have a value
	expect(
		cache.read({
			selection: {
				id: {
					type: 'ID',
					keyRaw: 'id',
				},
			},
			parent: 'User:1',
		}).data
	).toEqual({ id: '1' })

	// tick once more to clear the garbage
	cache._internal_unstable.collectGarbage()

	expect(
		cache.read({
			selection: {
				id: {
					type: 'ID',
					keyRaw: 'id',
				},
			},
			parent: 'User:1',
		})
	).toMatchObject({
		data: null,
	})
})

test('ticks of gc delete list handlers', function () {
	// instantiate a cache
	const cache = new Cache(config)

	const selection = {
		viewer: {
			type: 'User',
			keyRaw: 'viewer',
			fields: {
				id: {
					type: 'ID',
					keyRaw: 'id',
				},
				friends: {
					type: 'User',
					// the key takes an argument so that we can have multiple
					// lists tracked in the cache
					keyRaw: 'friends',
					list: {
						name: 'All_Users',
						connection: false,
						type: 'User',
					},
					fields: {
						id: {
							type: 'ID',
							keyRaw: 'id',
						},
						firstName: {
							type: 'String',
							keyRaw: 'firstName',
						},
					},
				},
			},
		},
	}

	// start off associated with one object
	cache.write({
		selection,
		variables: {
			var: 'hello',
		},
		data: {
			viewer: {
				id: '1',
				friends: [
					{
						id: '2',
						firstName: 'yves',
					},
				],
			},
		},
	})

	// a function to spy on that will play the role of set
	const set = vi.fn()

	cache.subscribe(
		{
			rootType: 'Query',
			set,
			selection,
		},
		{
			var: 'hello',
		}
	)

	cache.unsubscribe(
		{
			rootType: 'Query',
			set,
			selection,
		},
		{
			var: 'hello',
		}
	)

	// tick the garbage collector enough times to trigger garbage collection
	for (const _ of Array.from({ length: config.cacheBufferSize! + 1 })) {
		cache._internal_unstable.collectGarbage()
	}

	// make sure we dont have a handler for the list
	expect(cache._internal_unstable.lists.get('All_Users')).toBeNull()
})
