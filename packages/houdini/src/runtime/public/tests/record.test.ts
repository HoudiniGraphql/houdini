import { expect, test } from 'vitest'

import { rootID } from '../../cache/cache'
import type { SubscriptionSelection } from '../../lib'
import { Cache } from '../cache'
import { marshalNestedList, Record } from '../record'
import { testCache, type CacheTypeDefTest } from './test'

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
						__typename: {
							type: 'String',
							keyRaw: '__typename',
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
									__typename: {
										type: 'String',
										keyRaw: '__typename',
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
				__typename: 'User',
				parent: {
					id: '2',
					firstName: 'jane',
					__typename: 'User',
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
			__typename: 'User',
			parent: {
				id: '3',
				firstName: 'Jacob',
				__typename: 'User',
			},
		},
	})
})

test('record proxies need every field to compute the id', function () {
	const cache = testCache()
	expect(() => new Record({ cache, id: '1', type: 'User', idFields: {} })).toThrowError()
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
		link: false,
	})
	cache.setFieldType({
		parent: 'Cat',
		key: 'parent',
		type: 'User',
		nullable: true,
		link: true,
	})
	cache.setFieldType({
		parent: rootID,
		key: 'viewer',
		type: 'User',
		nullable: true,
		link: true,
	})
	cache.setFieldType({
		parent: 'User',
		key: 'id',
		type: 'ID',
		nullable: false,
		link: false,
	})
	cache.setFieldType({
		parent: rootID,
		key: 'users',
		type: 'User',
		nullable: true,
		link: true,
	})

	// update the cached value
	cache.root.set({
		field: 'test',
		value: null,
	})

	expect(cache.root.get({ field: 'test' })).toBeNull()

	// type check null types
	const cat = cache.get('Cat', { id: '1' })
	cat.set({ field: 'parent', value: null })
	expect(cat.get({ field: 'parent' })).toEqual(null)

	// type check setting the nullable value on root
	cache.root.set({ field: 'users', value: null })
	expect(cache.root.get({ field: 'users' })).toEqual(null)

	// typecheck an | null in the definition
	const user = cache.get('User', { id: '1' })
	cache.root.set({ field: 'viewer', value: user })
	cache.root.set({ field: 'viewer', value: null })
})

test('can set list types', function () {
	const cache = testCache()

	// we'll need to provide the type information
	cache.setFieldType({
		parent: rootID,
		key: 'pets',
		type: 'Pet',
		nullable: true,
		link: true,
	})
	cache.setFieldType({
		parent: 'Pet',
		key: 'id',
		type: 'ID',
		nullable: false,
		link: false,
	})

	// create a cat and a user
	const cat = cache.get('Cat', { id: '1' })
	const user = cache.get('User', { id: '2' })

	// set the pets value to the list
	cache.root.set({ field: 'pets', value: [cat, user] })

	// make sure we get the list back
	const value = cache.root.get({ field: 'pets' })
	const proxyValues = value.map((proxy) => ({ type: proxy.type, idFields: proxy.idFields }))
	expect(proxyValues).toEqual([
		{ type: 'Cat', idFields: { id: '1', __typename: 'Cat' } },
		{ type: 'User', idFields: { id: '2', __typename: 'User' } },
	])
})

test('can set union types', function () {
	const cache = testCache()

	// we'll need to provide the type information
	cache.setFieldType({
		parent: rootID,
		key: 'pet',
		type: 'Pet',
		nullable: true,
		link: true,
	})
	cache.setFieldType({
		parent: 'Pet',
		key: 'id',
		type: 'ID',
		nullable: false,
		link: false,
	})

	// create a cat and a user
	const cat = cache.get('Cat', { id: '1' })
	const user = cache.get('User', { id: '2' })

	// set the pets value to the union value
	cache.root.set({ field: 'pet', value: cat })
	cache.root.set({ field: 'pet', value: user })

	expect(cache.root.get({ field: 'pet' }).idFields).toEqual({
		__typename: 'User',
		id: '2',
	})
})

test('can set nested lists of record proxies', function () {
	const cache = testCache()

	cache.setFieldType({
		parent: rootID,
		key: 'listOfLists',
		type: 'Pet',
		nullable: true,
		link: true,
	})

	cache.setFieldType({
		parent: 'Pet',
		key: 'id',
		type: 'ID',
		nullable: false,
		link: false,
	})

	// build up some users
	const user1 = cache.get('User', { id: '1' })
	const user2 = cache.get('User', { id: '2' })
	const user3 = cache.get('User', { id: '3' })

	// set a nested list
	cache.root.set({
		field: 'listOfLists',
		value: [null, user1, [user2, [null, user3]]],
	})

	const expected = [
		null,
		{ id: '1', __typename: 'User' },
		[{ id: '2', __typename: 'User' }, [null, { id: '3', __typename: 'User' }]],
	]

	// make sure we wrote the correct value to cache
	expect(
		cache._internal_unstable.read({
			selection: {
				fields: {
					listOfLists: {
						keyRaw: 'listOfLists',
						type: 'User',
						nullable: true,
						abstract: true,
						selection: {
							fields: {
								id: {
									keyRaw: 'id',
									type: 'ID',
								},
								__typename: {
									keyRaw: '__typename',
									type: 'ID',
								},
							},
						},
					},
				},
			},
		}).data
	).toEqual({
		listOfLists: expected,
	})

	// and make sure we get the right value from the imperative API
	expect(marshalNestedList(cache.root.get({ field: 'listOfLists' }))).toEqual(expected)
})

/**               */
/**  Stale tests  */
/**   1/ Helpers  */
const h_SetUserInCache = (cache: Cache<CacheTypeDefTest>, id: string) => {
	const user = cache.get('User', { id })
	cache.setFieldType({ parent: 'User', key: 'id', type: 'String', nullable: false })
	user.set({ field: 'id', value: id })
	cache.setFieldType({ parent: 'User', key: 'firstName', type: 'String', nullable: false })
	user.set({ field: 'firstName', value: 'default name' })
	return user
}

const h_GetUserRecord = (id: string, field: 'id' | 'firstName' = 'id') => {
	return {
		type: 'User',
		id: `User:${id}`,
		field,
	}
}

const h_SetCatInCache = (cache: Cache<CacheTypeDefTest>, id: string) => {
	const cat = cache.get('Cat', { id })
	cache.setFieldType({ parent: 'Cat', key: 'id', type: 'String', nullable: false })
	cat.set({ field: 'id', value: id })
	return cat
}

const h_GetCatRecord = (id: string) => {
	return {
		type: 'Cat',
		id: `Cat:${id}`,
		field: 'id',
	}
}

const h_GetFieldTime = (
	cache: Cache<CacheTypeDefTest>,
	{ type, id, field }: { type: string; id: string; field: string }
) => {
	return cache._internal_unstable._internal_unstable.staleManager.getFieldTime(type, id, field)
}

/**               */
/**  Stale tests  */
/**   2/ Tests    */
test('info doesn t exist in the stale manager, return undefined (not stale)', async function () {
	const cache = testCache()

	// let's have a look at something that  was never seen before, it should be undefined
	expect(h_GetFieldTime(cache, h_GetCatRecord('1'))).toBe(undefined)
})

test('Mark all stale', async function () {
	const cache = testCache()

	// create some users & Cats
	h_SetUserInCache(cache, '1')
	h_SetUserInCache(cache, '2')
	h_SetCatInCache(cache, '8')
	h_SetCatInCache(cache, '9')

	// Nothing should be  null
	expect(h_GetFieldTime(cache, h_GetUserRecord('1'))).not.toBe(null)
	expect(h_GetFieldTime(cache, h_GetUserRecord('2'))).not.toBe(null)
	expect(h_GetFieldTime(cache, h_GetCatRecord('8'))).not.toBe(null)
	expect(h_GetFieldTime(cache, h_GetCatRecord('9'))).not.toBe(null)

	// make all stale
	cache.markStale()

	// every type `User` should be stale, but not the rest
	expect(h_GetFieldTime(cache, h_GetUserRecord('1'))).toBe(null)
	expect(h_GetFieldTime(cache, h_GetUserRecord('2'))).toBe(null)
	expect(h_GetFieldTime(cache, h_GetCatRecord('8'))).toBe(null)
	expect(h_GetFieldTime(cache, h_GetCatRecord('9'))).toBe(null)
})

test('Mark a type stale', async function () {
	const cache = testCache()

	// create some users & Cats
	h_SetUserInCache(cache, '1')
	h_SetUserInCache(cache, '2')
	h_SetCatInCache(cache, '8')
	h_SetCatInCache(cache, '9')

	// Nothing should be null
	expect(h_GetFieldTime(cache, h_GetUserRecord('1'))).not.toBe(null)
	expect(h_GetFieldTime(cache, h_GetUserRecord('2'))).not.toBe(null)
	expect(h_GetFieldTime(cache, h_GetCatRecord('8'))).not.toBe(null)
	expect(h_GetFieldTime(cache, h_GetCatRecord('9'))).not.toBe(null)

	// make the type `User` stale
	cache.markStale('User')

	// every type `User` should be stale, but not the rest
	expect(h_GetFieldTime(cache, h_GetUserRecord('1'))).toBe(null)
	expect(h_GetFieldTime(cache, h_GetUserRecord('2'))).toBe(null)
	expect(h_GetFieldTime(cache, h_GetCatRecord('8'))).not.toBe(null)
	expect(h_GetFieldTime(cache, h_GetCatRecord('9'))).not.toBe(null)
})

test('Mark a type field stale', async function () {
	const cache = testCache()

	// create some users
	h_SetUserInCache(cache, '1')
	h_SetUserInCache(cache, '2')

	// Nothing should be null
	expect(h_GetFieldTime(cache, h_GetUserRecord('1'))).not.toBe(null)
	expect(h_GetFieldTime(cache, h_GetUserRecord('2'))).not.toBe(null)
	expect(h_GetFieldTime(cache, h_GetUserRecord('1', 'firstName'))).not.toBe(null)
	expect(h_GetFieldTime(cache, h_GetUserRecord('2', 'firstName'))).not.toBe(null)

	// make the type `User` field `firstName` stale
	cache.markStale('User', 'firstName')

	// every type `User` should be stale, but not the rest
	expect(h_GetFieldTime(cache, h_GetUserRecord('1'))).not.toBe(null)
	expect(h_GetFieldTime(cache, h_GetUserRecord('2'))).not.toBe(null)
	expect(h_GetFieldTime(cache, h_GetUserRecord('1', 'firstName'))).toBe(null)
	expect(h_GetFieldTime(cache, h_GetUserRecord('2', 'firstName'))).toBe(null)
})

test('Mark a record stale', async function () {
	const cache = testCache()

	// create a user
	const user1 = h_SetUserInCache(cache, '1')

	// check data state of stale
	expect(h_GetFieldTime(cache, h_GetUserRecord('1'))).not.toBe(null)
	expect(h_GetFieldTime(cache, h_GetUserRecord('1', 'firstName'))).not.toBe(null)

	// mark a record stale
	user1.markStale()

	// check data state of stale
	expect(h_GetFieldTime(cache, h_GetUserRecord('1'))).toBe(null)
	expect(h_GetFieldTime(cache, h_GetUserRecord('1', 'firstName'))).toBe(null)
})

test('Mark a record field stale', async function () {
	const cache = testCache()

	// create a user
	const user1 = h_SetUserInCache(cache, '1')

	// check data state of stale
	expect(h_GetFieldTime(cache, h_GetUserRecord('1'))).not.toBe(null)
	expect(h_GetFieldTime(cache, h_GetUserRecord('1', 'firstName'))).not.toBe(null)

	// mark a field stale
	user1.markStale({ field: 'id' })

	// check data state of stale
	expect(h_GetFieldTime(cache, h_GetUserRecord('1'))).toBe(null)
	expect(h_GetFieldTime(cache, h_GetUserRecord('1', 'firstName'))).not.toBe(null)
})

test('Mark a record field stale when args', async function () {
	const cache = testCache()

	// create a user
	const user1 = h_SetUserInCache(cache, '1')

	// check data state of stale
	expect(h_GetFieldTime(cache, h_GetUserRecord('1'))).not.toBe(null)
	expect(h_GetFieldTime(cache, h_GetUserRecord('1', 'firstName'))).not.toBe(null)

	// mark a field stale
	user1.markStale({ field: 'id', args: {} })
	expect('args typing???').toBe(false)

	// check data state of stale
	expect(h_GetFieldTime(cache, h_GetUserRecord('1'))).toBe(null)
	expect(h_GetFieldTime(cache, h_GetUserRecord('1', 'firstName'))).not.toBe(null)
})
