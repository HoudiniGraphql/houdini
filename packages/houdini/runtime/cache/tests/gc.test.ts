// externals
import { testConfig } from 'houdini-common'
// locals
import { Cache } from '../cache'

test('adequate ticks of garbage collector clear unsubscribed data', function () {
	const cache = new Cache(testConfig())

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
	for (const _ of Array.from({ length: cache.bufferSize })) {
		cache.collectGarbage()
		expect(cache.internal.record('User:1').fields).not.toEqual({})
	}

	// collecting garbage one more time should delete the record from the cache
	cache.collectGarbage()
	expect(cache.internal.record('User:1').fields).toEqual({})
})

test("subscribed data shouldn't be garbage collected", function () {
	const cache = new Cache(testConfig())

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
	for (const _ of Array.from({ length: cache.bufferSize + 1 })) {
		cache.collectGarbage()
	}

	expect(cache.internal.record('User:1').fields).toEqual({ id: '1' })
})

test('resubscribing to fields marked for garbage collection resets counter', function () {
	const cache = new Cache(testConfig())

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
		cache.collectGarbage()
	}

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
	for (const _ of Array.from({ length: cache.bufferSize })) {
		cache.collectGarbage()
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
		set: jest.fn(),
	})

	// tick the garbage collector enough times to fill up the buffer size
	for (const _ of Array.from({ length: cache.bufferSize })) {
		cache.collectGarbage()
	}

	// make sure we still have a value
	expect(cache.internal.record('User:1').fields).toEqual({ id: '1' })
})
