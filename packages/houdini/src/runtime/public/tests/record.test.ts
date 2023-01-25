import { test, expect } from 'vitest'

import { ArtifactKind, type FragmentArtifact, type SubscriptionSelection } from '../../lib'
import { Cache } from '../cache'
import { CacheTypeDefTest, testCache, testFragment } from './test'

test('can read fragment', function () {
	const cache = testCache()

	const selection = {
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

	// look up the values we just wrote
	expect(
		cache
			.get('User', { id: '1' })
			.read({ fragment: testFragment(selection.fields.viewer.selection) })
	).toEqual({
		partial: false,
		stale: false,
		data: {
			id: '1',
			firstName: 'bob',
			__typename: 'User',
			parent: {
				id: '2',
				firstName: 'jane',
				__typename: 'User',
			},
		},
	})
})

test('can writeFragments', function () {
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

	const artifact: FragmentArtifact = {
		kind: ArtifactKind.Fragment,
		name: 'string',
		raw: 'string',
		hash: 'string',
		rootType: 'string',
		selection: {
			fields: {
				firstName: {
					type: 'String',
					keyRaw: 'firstName',
				},
			},
		},
	}

	// write a fragment to update User:2
	cache.get('User', { id: '2' }).write({
		fragment: {
			artifact,
		},
		data: {
			firstName: 'michael',
		},
	})

	// make sure we updated the field
	expect(
		cache.get('User', { id: '2' }).read({ fragment: testFragment(artifact.selection) })
	).toEqual({
		partial: false,
		stale: false,
		data: {
			firstName: 'michael',
		},
	})
})

test('can read and write variables', function () {
	const cache = testCache()

	const artifact: FragmentArtifact = {
		kind: ArtifactKind.Fragment,
		name: 'string',
		raw: 'string',
		hash: 'string',
		rootType: 'string',
		selection: {
			fields: {
				firstName: {
					type: 'String',
					keyRaw: 'firstName(pattern: $pattern)',
				},
			},
		},
	}

	// write a fragment to update User:2
	cache.get('User', { id: '2' }).write({
		fragment: {
			artifact,
		},
		data: {
			firstName: 'michael',
		},
		variables: {
			pattern: 'foo',
		},
	})

	// make sure we cached the right value for the key
	expect(
		cache._internal_unstable.read({
			parent: 'User:2',
			selection: {
				fields: {
					firstName: {
						keyRaw: 'firstName(pattern: "foo")',
						type: 'String',
					},
				},
			},
		}).data
	).toEqual({ firstName: 'michael' })

	// read from the cache with variables too
	expect(
		cache.get('User', { id: '2' }).read({
			fragment: {
				artifact,
			},
			variables: {
				pattern: 'foo',
			},
		}).data
	).toEqual({ firstName: 'michael' })
})

/**               */
/**  Stale tests  */
/**   1/ Helpers  */
const h_SetUserInCache = (cache: Cache<CacheTypeDefTest>, id: string) => {
	// JYC TODO set in cache?
	const artifact: FragmentArtifact = {
		kind: ArtifactKind.Fragment,
		name: 'string',
		raw: 'string',
		hash: 'string',
		rootType: 'string',
		selection: {
			fields: {
				firstName: {
					type: 'String',
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
			firstName: 'default name',
		},
	})

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
	// JYC TODO set in cache?
	const artifact: FragmentArtifact = {
		kind: ArtifactKind.Fragment,
		name: 'string',
		raw: 'string',
		hash: 'string',
		rootType: 'string',
		selection: {
			fields: {
				id: {
					type: 'String',
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
	//JYC to remove
	console.log(
		`cache._internal_unstable._internal_unstable.staleManager.fieldsTime`,
		cache._internal_unstable._internal_unstable.staleManager.fieldsTime
	)

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
	console.log(`cache`, cache._internal_unstable._internal_unstable.staleManager.fieldsTime)

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
	// JYC TODO: how to type args?
	user1.markStale({
		field: 'id',
		//, args: {}
	})
	expect('args typing???').toBe(false)

	// check data state of stale
	expect(h_GetFieldTime(cache, h_GetUserRecord('1'))).toBe(null)
	expect(h_GetFieldTime(cache, h_GetUserRecord('1', 'firstName'))).not.toBe(null)
})
