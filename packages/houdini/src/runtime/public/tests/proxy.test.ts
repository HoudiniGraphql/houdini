import { test, expect } from 'vitest'

import { testConfigFile } from '../../../test'
import { Cache, rootID } from '../../cache/cache'
import { SubscriptionSelection } from '../../lib'
import { CacheProxy } from '../cache'
import { RecordProxy } from '../record'

// the type definition for our test cache
type CacheTypeDef = {
	types: {
		__ROOT__: {
			idFields: {}
			fields: {
				test: {
					type: number | null
					args: never
				}
				testDate: {
					type: Date
					args: never
				}
				viewer: {
					type: { type: 'User' }
					args: never
				}
				pets: {
					type: { list: 'Cat' | 'User' }
					args: never
				}
				pet: {
					type: { union: 'Cat' | 'User' }
					args: never
				}
			}
		}
		User: {
			idFields: {
				id: string
			}
			fields: {
				firstName: {
					type: string
					args: never
				}
				parent: {
					type: { type: 'User' }
					args: never
				}
				id: {
					type: string
					args: never
				}
			}
		}
		Cat: {
			idFields: {
				id: string
			}
			fields: {
				name: {
					type: string | null
					args: never
				}
				id: {
					type: string
					args: never
				}
			}
		}
	}
	lists: {}
}

const testCache = () => new CacheProxy<CacheTypeDef>(new Cache(testConfigFile()))

test('must have schema information to set field', function () {
	const cache = testCache()
	expect(() => cache.root.set({ field: 'test', value: 1 })).toThrowError()
})

test('must have schema information to read field', function () {
	const cache = testCache()
	expect(() => cache.root.get({ field: 'test' })).toThrowError()
})

test('can set root field value to scalar', function () {
	const cache = testCache()

	// we'll need to provide the type information
	cache.setFieldType({
		parent: rootID,
		key: 'test',
		type: 'Int',
		nullable: true,
	})

	// update the cached value
	cache.root.set({
		field: 'test',
		value: 1,
	})

	// read the value
	expect(
		cache._internal_unstable.read({
			selection: {
				fields: {
					test: {
						keyRaw: 'test',
						type: 'Int',
					},
				},
			},
		}).data
	).toEqual({
		test: 1,
	})
})

test('can read root field value', function () {
	const cache = testCache()

	// we'll need to provide the type information
	cache.setFieldType({
		parent: rootID,
		key: 'test',
		type: 'Int',
		nullable: true,
	})

	// update the cached value
	cache.root.set({
		field: 'test',
		value: 1,
	})

	// read the value
	expect(cache.root.get({ field: 'test' })).toEqual(1)
})

test('can set custom scalar value', function () {
	const cache = testCache()

	const targetDate = new Date()

	// we'll need to provide the type information
	cache.setFieldType({
		parent: rootID,
		key: 'testDate',
		type: 'DateTime',
		nullable: true,
	})

	// update the cached value
	cache.root.set({
		field: 'testDate',
		value: targetDate,
	})

	// look up the value the "normal" way to ensure we marshaled the date
	expect(
		cache._internal_unstable.read({
			selection: {
				fields: {
					testDate: {
						keyRaw: 'testDate',
						type: 'DateTime',
					},
				},
			},
		}).data
	).toEqual({
		testDate: targetDate,
	})
})

test('can read custom scalar value', function () {
	const cache = testCache()

	const targetDate = new Date()

	// we'll need to provide the type information
	cache.setFieldType({
		parent: rootID,
		key: 'test',
		type: 'DateTime',
		nullable: true,
	})

	// write the scalar value to the layer directly
	cache._internal_unstable._internal_unstable.storage.topLayer.writeField(
		rootID,
		'test',
		targetDate.getTime()
	)

	// read the cached value
	expect(cache.root.get({ field: 'test' })).toEqual(targetDate)
})

test('can read and write linked records', function () {
	const cache = testCache()

	const selection: SubscriptionSelection = {
		fields: {
			viewer: {
				type: 'User',
				keyRaw: 'viewer',
				selection: {
					fields: {
						id: {
							type: 'ID',
							keyRaw: 'id',
						},
						firstName: {
							type: 'String',
							keyRaw: 'firstName',
						},
						parent: {
							type: 'User',
							keyRaw: 'parent',
							selection: {
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
				},
			},
		},
	}

	// write the data as a deeply nested object
	cache._internal_unstable.write({
		selection,
		data: {
			viewer: {
				id: '1',
				firstName: 'bob',
				parent: {
					id: '2',
					firstName: 'jane',
				},
			},
		},
	})

	// look up the linked record
	const viewer = cache.get('User', { id: '1' })

	// get the linked parent
	const parent = viewer.get({ field: 'parent' })

	// make sure we got the correct record proxy out
	expect(parent.get({ field: 'id' })).toEqual('2')

	// get another user record
	const otherUser = cache.get('User', { id: '3' })
	otherUser.set({ field: 'firstName', value: 'Jacob' })

	// assign the new link
	viewer.set({ field: 'parent', value: otherUser })

	// read from the cache and make sure we get the right values
	expect(
		cache._internal_unstable.read({
			selection,
		}).data
	).toEqual({
		viewer: {
			id: '1',
			firstName: 'bob',
			parent: {
				id: '3',
				firstName: 'Jacob',
			},
		},
	})
})

test('record proxies need every field to compute the id', function () {
	const cache = testCache()
	expect(() => new RecordProxy({ cache, id: '1', type: 'User', idFields: {} })).toThrowError()
})

test("writing a field that isn't in the display layer still gets grabage collected", function () {
	const cache = testCache()

	const user = cache.get('User', { id: '1' })
	cache.setFieldType({
		parent: 'User',
		key: 'firstName',
		type: 'String',
	})
	user.set({ field: 'firstName', value: 'John' })

	// tick the garbage collector enough times to fill up the buffer size
	for (const _ of Array.from({ length: 10 })) {
		cache._internal_unstable._internal_unstable.collectGarbage()
		expect(user.get({ field: 'firstName' })).toEqual('John')
	}

	// collecting garbage one more time should remove the record from the cache
	cache._internal_unstable._internal_unstable.collectGarbage()
	expect(user.get({ field: 'firstName' })).toBeUndefined()
})

test('writing a field resets field life time', function () {
	const cache = testCache()

	const user = cache.get('User', { id: '1' })
	cache.setFieldType({
		parent: 'User',
		key: 'firstName',
		type: 'String',
	})
	user.set({ field: 'firstName', value: 'John' })

	// tick the garbage collector enough times to fill up the buffer size
	for (const _ of Array.from({ length: 10 })) {
		cache._internal_unstable._internal_unstable.collectGarbage()
		expect(user.get({ field: 'firstName' })).toEqual('John')
	}

	// update the value one more time
	user.set({ field: 'firstName', value: 'John' })

	// collecting garbage one more time shouldn't remove the record from the cache
	cache._internal_unstable._internal_unstable.collectGarbage()
	expect(user.get({ field: 'firstName' })).toEqual('John')
})

test('can pass null', function () {
	const cache = testCache()

	// we'll need to provide the type information
	cache.setFieldType({
		parent: rootID,
		key: 'test',
		type: 'Int',
		nullable: true,
	})

	// update the cached value
	cache.root.set({
		field: 'test',
		value: null,
	})

	expect(cache.root.get({ field: 'test' })).toBeNull()
})

test('can set list types', function () {
	const cache = testCache()

	// create a cat and a user
	const cat = cache.get('Cat', { id: '1' })
	const user = cache.get('User', { id: '2' })

	// we'll need to provide the type information
	cache.setFieldType({
		parent: rootID,
		key: 'pets',
		type: 'Pet',
		nullable: true,
	})

	// set the pets value to the list
	cache.root.set({ field: 'pets', value: [cat, user] })

	// make sure we get the list back
	const value = cache.root.get({ field: 'pets' })
	const proxyValues = value.map((proxy) => ({ type: proxy.type, id: proxy.idFields }))
	expect(proxyValues).toEqual([
		{ type: 'User', idFields: { id: '1' } },
		{ type: 'Cat', idFields: { id: '2' } },
	])
})

test('can set union types', function () {
	const cache = testCache()

	// create a cat and a user
	const cat = cache.get('Cat', { id: '1' })
	const user = cache.get('User', { id: '2' })

	// we'll need to provide the type information
	cache.setFieldType({
		parent: rootID,
		key: 'pet',
		type: 'Pet',
		nullable: true,
	})

	// set the pets value to the list
	cache.root.set({ field: 'pet', value: cat })
	cache.root.set({ field: 'pet', value: user })

	expect(cache.root.get({ field: 'pet' }).idFields).toEqual({
		id: '2',
	})
})

test.todo('complex keys')

test.todo('set list of linked values - flat list')

test.todo('set list of linked values - connection')
