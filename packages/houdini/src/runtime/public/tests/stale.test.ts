import { test, expect } from 'vitest'

import { ArtifactKind, type FragmentArtifact } from '../../lib'
import type { Cache } from '../cache'
import { type CacheTypeDefTest, testCache } from './helper.test'

/**   1/ Helpers  */
const h_SetUserInCache = (cache: Cache<CacheTypeDefTest>, id: string) => {
	const artifact: FragmentArtifact = {
		kind: ArtifactKind.Fragment,
		name: 'string',
		raw: 'string',
		hash: 'string',
		rootType: 'string',
		pluginData: {},
		selection: {
			fields: {
				id: {
					type: 'String',
					visible: true,
					keyRaw: 'id',
				},
				firstName: {
					type: 'String',
					visible: true,
					keyRaw: 'firstName',
				},
			},
		},
	}

	const user = cache.get('User', { id })
	user.write({
		fragment: {
			artifact,
		},
		data: {
			// @ts-expect-error: type definitions for the test api are busted
			id,
			firstName: 'newName',
		},
	})

	return user
}

const h_GetUserRecord = (id: string, field: string = 'id') => {
	return {
		type: 'User',
		visible: true,
		id: `User:${id}`,
		field,
	}
}

const h_SetCatInCache = (cache: Cache<CacheTypeDefTest>, id: string) => {
	const artifact: FragmentArtifact = {
		kind: ArtifactKind.Fragment,
		name: 'string',
		raw: 'string',
		hash: 'string',
		rootType: 'string',
		pluginData: {},
		selection: {
			fields: {
				id: {
					type: 'String',
					visible: true,
					keyRaw: 'id',
				},
			},
		},
	}

	const cat = cache.get('Cat', { id })
	cat.write({
		fragment: {
			artifact,
		},
		// @ts-expect-error: type definitions for the test api are busted
		data: {
			id,
		},
	})

	// cache.setFieldType({ parent: 'Cat', key: 'id', type: 'String', nullable: false })
	// cat.set({ field: 'id', value: id })
	return cat
}

const h_GetCatRecord = (id: string) => {
	return {
		type: 'Cat',
		visible: true,
		id: `Cat:${id}`,
		field: 'id',
	}
}

const h_GetFieldTime = (
	cache: Cache<CacheTypeDefTest>,
	{ id, field }: { id: string; field: string }
) => {
	return cache._internal_unstable.getFieldTime(id, field)
}

/**   2/ Tests    */
test("info doesn't exist in the stale manager, return undefined (not stale)", async function () {
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
	cache.markStale('User', { field: 'firstName' })

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
	expect(h_GetFieldTime(cache, h_GetUserRecord('1', 'id'))).not.toBe(null)
	expect(h_GetFieldTime(cache, h_GetUserRecord('1', 'firstName'))).not.toBe(null)

	// mark a field stale
	user1.markStale('id')

	// check data state of stale
	expect(h_GetFieldTime(cache, h_GetUserRecord('1', 'id'))).toBe(null)
	expect(h_GetFieldTime(cache, h_GetUserRecord('1', 'firstName'))).not.toBe(null)
})

test('Mark a record field stale when args', async function () {
	const cache = testCache()

	// create a user
	const user1 = h_SetUserInCache(cache, '1')

	// check data state of stale
	expect(h_GetFieldTime(cache, h_GetUserRecord('1'))).not.toBe(null)
	expect(h_GetFieldTime(cache, h_GetUserRecord('1', 'id'))).not.toBe(null)

	// mark a field stale
	// @ts-expect-error: generated type definitions are busted locally
	user1.markStale('id', { when: { id: '1' } })

	// check data state of stale
	expect(h_GetFieldTime(cache, h_GetUserRecord('1', 'id(id: "1")'))).toBe(null)
	expect(h_GetFieldTime(cache, h_GetUserRecord('1', 'id'))).not.toBe(null)
	expect(h_GetFieldTime(cache, h_GetUserRecord('1', 'firstName'))).not.toBe(null)
	expect(h_GetFieldTime(cache, h_GetUserRecord('1'))).not.toBe(null)
})
