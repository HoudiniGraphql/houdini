import { test, expect } from 'vitest'

import { recordsAtPath } from '../../plugins/cache.js'

test('walks a path to a singular record', () => {
	const data = { addFriend: { friend: { __typename: 'User', id: '1' } } }
	expect(recordsAtPath(data, ['addFriend', 'friend'])).toEqual([{ __typename: 'User', id: '1' }])
})

test('returns every record when the @refetch field itself is a list', () => {
	const data = {
		updateFriends: [
			{ __typename: 'User', id: '1' },
			{ __typename: 'User', id: '2' },
		],
	}
	expect(recordsAtPath(data, ['updateFriends'])).toEqual([
		{ __typename: 'User', id: '1' },
		{ __typename: 'User', id: '2' },
	])
})

test('fans out when a path segment is a list', () => {
	const data = {
		updateUsers: [{ bestFriend: { id: '2' } }, { bestFriend: { id: '3' } }],
	}
	expect(recordsAtPath(data, ['updateUsers', 'bestFriend'])).toEqual([{ id: '2' }, { id: '3' }])
})

test('flattens nested lists along the path', () => {
	const data = { groups: [[{ user: { id: 'a' } }], [{ user: { id: 'b' } }]] }
	expect(recordsAtPath(data, ['groups', 'user'])).toEqual([{ id: 'a' }, { id: 'b' }])
})

test('skips null links without throwing', () => {
	expect(recordsAtPath({ addFriend: null }, ['addFriend', 'friend'])).toEqual([])
	expect(recordsAtPath(null, ['addFriend'])).toEqual([])
})
