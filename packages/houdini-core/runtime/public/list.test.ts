import { test, expect, vi } from 'vitest'

import type { SubscriptionSelection } from 'houdini/runtime/types'
import { testCache, testFragment } from './tests/test.js'

const friendsSelection: SubscriptionSelection = {
	fields: {
		viewer: {
			type: 'User',
			visible: true,
			keyRaw: 'viewer',
			selection: {
				fields: {
					id: { type: 'ID', visible: true, keyRaw: 'id' },
					friends: {
						type: 'User',
						visible: true,
						keyRaw: 'friends',
						list: { name: 'All_Users', connection: false, type: 'User' },
						selection: {
							fields: {
								id: { type: 'ID', visible: true, keyRaw: 'id' },
								firstName: { type: 'String', visible: true, keyRaw: 'firstName' },
							},
						},
					},
				},
			},
		},
	},
}

test('upsert inserts record when not already in list', () => {
	const cache = testCache()

	cache._internal_unstable.write({
		selection: friendsSelection,
		data: { viewer: { id: '1', friends: [{ id: '2', firstName: 'jane' }] } },
	})
	cache._internal_unstable.subscribe({ rootType: 'Query', set: vi.fn(), selection: friendsSelection })

	const user = cache.get('User', { id: '3' })
	user.write({
		fragment: testFragment({ fields: { firstName: { type: 'String', visible: true, keyRaw: 'firstName' } } }),
		data: { firstName: 'mary' },
	})

	const list = cache.list('All_Users')
	list.upsert('last', user)

	expect([...list]).toEqual(['User:2', 'User:3'])
})

test('upsert updates existing record when already in list', () => {
	const cache = testCache()

	cache._internal_unstable.write({
		selection: friendsSelection,
		data: {
			viewer: {
				id: '1',
				friends: [
					{ id: '2', firstName: 'jane' },
					{ id: '3', firstName: 'mary' },
				],
			},
		},
	})

	const set = vi.fn()
	cache._internal_unstable.subscribe({ rootType: 'Query', set, selection: friendsSelection })

	const user = cache.get('User', { id: '3' })
	user.write({
		fragment: testFragment({ fields: { firstName: { type: 'String', visible: true, keyRaw: 'firstName' } } }),
		data: { firstName: 'mary-updated' },
	})

	const list = cache.list('All_Users')
	list.upsert('last', user)

	// list must not grow
	expect([...list]).toEqual(['User:2', 'User:3'])

	// subscriber receives the updated field
	expect(set).toHaveBeenLastCalledWith({
		viewer: {
			id: '1',
			friends: [
				{ id: '2', firstName: 'jane' },
				{ id: '3', firstName: 'mary-updated' },
			],
		},
	})
})
