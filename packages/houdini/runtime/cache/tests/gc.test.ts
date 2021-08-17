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
