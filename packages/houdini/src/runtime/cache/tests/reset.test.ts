import { test, expect, vi } from 'vitest'

import { testConfigFile } from '../../../test'
import { RefetchUpdateMode, type SubscriptionSelection } from '../../lib'
import { Cache } from '../cache'

const config = testConfigFile()

test('make sure the cache data was reset', function () {
	const cache = new Cache(config)

	// save the data
	const data = {
		viewer: {
			id: '1',
			firstName: 'bob',
		},
	}

	const selection: SubscriptionSelection = {
		fields: {
			viewer: {
				type: 'User',
				visible: true,
				keyRaw: 'viewer',
				selection: {
					fields: {
						id: {
							type: 'ID',
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
			},
		},
	}

	cache.write({
		selection,
		data,
	})

	// reset the cache
	cache.reset()

	// make sure the data is gone
	expect(cache.read({ selection }).data).toBe(null)
})

test('make sure the cache lists were reset', function () {
	const cache = new Cache(config)

	const selection: SubscriptionSelection = {
		fields: {
			viewer: {
				type: 'User',
				visible: true,
				keyRaw: 'viewer',
				selection: {
					fields: {
						id: {
							type: 'ID',
							visible: true,
							keyRaw: 'id',
						},
						friends: {
							type: 'User',
							visible: true,
							keyRaw: 'friends',
							updates: [RefetchUpdateMode.append],
							list: {
								name: 'All_Users',
								connection: false,
								type: 'User',
							},
							selection: {
								fields: {
									id: {
										type: 'ID',
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
						},
					},
				},
			},
		},
	}

	cache.write({
		selection,
		data: {
			viewer: {
				id: '1',
				friends: [
					{
						id: '2',
						firstName: 'jane',
					},
					{
						id: '3',
						firstName: 'joe',
					},
				],
			},
		},
		applyUpdates: [RefetchUpdateMode.append],
	})
	const set = vi.fn()
	cache.subscribe({
		rootType: 'Query',
		set,
		selection,
	})

	expect(() => cache.list('All_Users')).toBeDefined()

	// reset the cache
	cache.reset()

	// make sure the list doesn't exist
	expect(() => cache.list('All_Users')).toThrowError('Cannot find list with name')
})

test('make sure the cache subscribers were reset', function () {
	const cache = new Cache(config)

	const selection: SubscriptionSelection = {
		fields: {
			viewer: {
				type: 'User',
				visible: true,
				keyRaw: 'viewer',
				selection: {
					fields: {
						id: {
							type: 'ID',
							visible: true,
							keyRaw: 'id',
						},
						firstName: {
							type: 'String',
							visible: true,
							keyRaw: 'firstName',
						},
						friends: {
							type: 'User',
							visible: true,
							keyRaw: 'friends',
							updates: [RefetchUpdateMode.append],
							selection: {
								fields: {
									id: {
										type: 'ID',
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
						},
					},
				},
			},
		},
	}

	cache.write({
		selection,
		data: {
			viewer: {
				id: '1',
				firstName: 'bob',
				friends: [
					{
						id: '2',
						firstName: 'jane',
					},
					{
						id: '3',
						firstName: 'joe',
					},
				],
			},
		},
		applyUpdates: [RefetchUpdateMode.append],
	})

	// subscribe to the cache
	const set = vi.fn()
	cache.subscribe({
		rootType: 'Query',
		set,
		selection,
	})

	// reset the cache
	cache.reset()
})
