import { test, expect, vi } from 'vitest'

import { SubscriptionSelection } from '../../lib'
import { testCache } from './test'

test('list.append accepts record proxies', function () {
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
						friends: {
							type: 'User',
							keyRaw: 'friends',
							list: {
								name: 'All_Pets',
								connection: true,
								type: 'User',
							},
							selection: {
								fields: {
									edges: {
										type: 'UserEdge',
										keyRaw: 'edges',
										selection: {
											fields: {
												node: {
													type: 'Node',
													keyRaw: 'node',
													abstract: true,
													selection: {
														fields: {
															__typename: {
																type: 'String',
																keyRaw: '__typename',
															},
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
							},
						},
					},
				},
			},
		},
	}

	// start off associated with one object
	cache._internal_unstable.write({
		selection,
		data: {
			viewer: {
				id: '1',
				friends: {
					edges: [
						{
							node: {
								__typename: 'Cat',
								id: '2',
								firstName: 'mary',
							},
						},
						{
							node: {
								__typename: 'User',
								id: '3',
								firstName: 'jane',
							},
						},
					],
				},
			},
		},
	})

	// a function to spy on that will play the role of set
	const set = vi.fn()

	// subscribe to the fields
	cache._internal_unstable.subscribe({
		rootType: 'Query',
		set,
		selection,
	})

	// create a user
	const user = cache.get('User', { id: '4' })
	user.set({ field: 'firstName', value: 'jacob' })

	cache.list('All_Pets').append(user)

	// make sure the duplicate has been removed
	expect(set).toHaveBeenCalledWith({
		viewer: {
			id: '1',
			friends: {
				edges: [
					{
						node: {
							__typename: 'Cat',
							id: '2',
							firstName: 'mary',
						},
					},
					{
						node: {
							__typename: 'User',
							id: '3',
							firstName: 'jane',
						},
					},
					{
						node: {
							__typename: 'User',
							id: '4',
							firstName: 'jacob',
						},
					},
				],
			},
		},
	})
})

test('list.prepend accepts record proxies', function () {
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
						friends: {
							type: 'User',
							keyRaw: 'friends',
							list: {
								name: 'All_Pets',
								connection: true,
								type: 'User',
							},
							selection: {
								fields: {
									edges: {
										type: 'UserEdge',
										keyRaw: 'edges',
										selection: {
											fields: {
												node: {
													type: 'Node',
													keyRaw: 'node',
													abstract: true,
													selection: {
														fields: {
															__typename: {
																type: 'String',
																keyRaw: '__typename',
															},
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
							},
						},
					},
				},
			},
		},
	}

	// start off associated with one object
	cache._internal_unstable.write({
		selection,
		data: {
			viewer: {
				id: '1',
				friends: {
					edges: [
						{
							node: {
								__typename: 'Cat',
								id: '2',
								firstName: 'mary',
							},
						},
						{
							node: {
								__typename: 'User',
								id: '3',
								firstName: 'jane',
							},
						},
					],
				},
			},
		},
	})

	// a function to spy on that will play the role of set
	const set = vi.fn()

	// subscribe to the fields
	cache._internal_unstable.subscribe({
		rootType: 'Query',
		set,
		selection,
	})

	// create a user
	const user = cache.get('User', { id: '4' })
	user.set({ field: 'firstName', value: 'jacob' })

	cache.list('All_Pets').prepend(user)

	// make sure the duplicate has been removed
	expect(set).toHaveBeenCalledWith({
		viewer: {
			id: '1',
			friends: {
				edges: [
					{
						node: {
							__typename: 'User',
							id: '4',
							firstName: 'jacob',
						},
					},
					{
						node: {
							__typename: 'Cat',
							id: '2',
							firstName: 'mary',
						},
					},
					{
						node: {
							__typename: 'User',
							id: '3',
							firstName: 'jane',
						},
					},
				],
			},
		},
	})
})

test('list when must', function () {
	// instantiate a cache
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
						friends: {
							type: 'User',
							keyRaw: 'friends',
							list: {
								name: 'All_Users',
								connection: false,
								type: 'User',
							},
							filters: {
								foo: {
									kind: 'String',
									value: 'bar',
								},
							},
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

	// start off associated with one object
	cache._internal_unstable.write({
		selection,
		data: {
			viewer: {
				id: '1',
				friends: [
					{
						id: '2',
						firstName: 'jane',
					},
				],
			},
		},
	})

	// a function to spy on that will play the role of set
	const set = vi.fn()

	// subscribe to the fields
	cache._internal_unstable.subscribe({
		rootType: 'Query',
		set,
		selection,
	})

	const user = cache.get('User', { id: '3' })
	user.set({ field: 'firstName', value: 'mary' })

	// apply the when
	cache
		.list('All_Users')
		.when({ must_not: { foo: 'not-bar' } })
		.prepend(user)

	// make sure we got the new value
	expect(set).toHaveBeenCalledWith({
		viewer: {
			id: '1',
			friends: [
				{
					firstName: 'mary',
					id: '3',
				},
				{
					firstName: 'jane',
					id: '2',
				},
			],
		},
	})
})
