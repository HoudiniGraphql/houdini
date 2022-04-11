// locals
import { testConfigFile } from '~/common'
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
		set: jest.fn(),
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

	const set = jest.fn()

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
