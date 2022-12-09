import { test, expect } from 'vitest'

import { testConfigFile } from '../../../test'
import { SubscriptionSelection } from '../../lib'
import { Cache, rootID } from '../cache'
import { CacheProxy, RecordProxy } from '../publicWrapper'

const testCache = () => new CacheProxy(new Cache(testConfigFile()))

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
		key: 'test',
		type: 'DateTime',
		nullable: true,
	})

	// update the cached value
	cache.root.set({
		field: 'test',
		value: targetDate,
	})

	// look up the value the "normal" way to ensure we marshaled the date
	expect(
		cache._internal_unstable.read({
			selection: {
				fields: {
					test: {
						keyRaw: 'test',
						type: 'DateTime',
					},
				},
			},
		}).data
	).toEqual({
		test: targetDate,
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

test.todo('writing a field should reset its lifetime')

test.todo('complex keys')

test.todo('scalar subscriptions')

test.todo('linked record subscriptions')

test.todo('set list of linked values - flat list')

test.todo('set list of linked values - connection')
