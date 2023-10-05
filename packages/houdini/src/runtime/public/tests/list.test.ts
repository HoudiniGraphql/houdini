import { test, expect, vi } from 'vitest'

import { type SubscriptionSelection } from '../../lib'
import { testCache, testFragment } from './helper.test'

test('list.append accepts record proxies', function () {
	const cache = testCache()

	const selection = {
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
							list: {
								name: 'All_Pets',
								connection: true,
								type: 'User',
								visible: true,
							},
							selection: {
								fields: {
									edges: {
										type: 'UserEdge',
										visible: true,
										keyRaw: 'edges',
										updates: ['append'],
										selection: {
											fields: {
												node: {
													type: 'Node',
													visible: true,
													keyRaw: 'node',
													abstract: true,
													selection: {
														fields: {
															__typename: {
																type: 'String',
																visible: true,
																keyRaw: '__typename',
															},
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
	user.write({
		fragment: testFragment({
			fields: {
				firstName: {
					type: 'String',
					visible: true,
					keyRaw: 'firstName',
				},
			},
		}),
		data: {
			firstName: 'jacob',
		},
	})

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

	const selection = {
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
							list: {
								name: 'All_Pets',
								connection: true,
								type: 'User',
								visible: true,
							},
							selection: {
								fields: {
									edges: {
										type: 'UserEdge',
										visible: true,
										keyRaw: 'edges',
										selection: {
											fields: {
												node: {
													type: 'Node',
													visible: true,
													keyRaw: 'node',
													abstract: true,
													selection: {
														fields: {
															__typename: {
																type: 'String',
																visible: true,
																keyRaw: '__typename',
															},
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
	user.write({
		fragment: testFragment({
			fields: {
				firstName: {
					type: 'String',
					visible: true,
					keyRaw: 'firstName',
				},
			},
		}),
		data: {
			firstName: 'jacob',
		},
	})

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
	user.write({
		fragment: testFragment({
			fields: {
				firstName: {
					type: 'String',
					visible: true,
					keyRaw: 'firstName',
				},
			},
		}),
		data: {
			firstName: 'mary',
		},
	})

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

test('can remove record', function () {
	// instantiate a cache
	const cache = testCache()

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

	// remove user 2 from the list
	cache.list('All_Users').remove(
		cache.get('User', {
			id: '2',
		})
	)

	// the first time set was called, a new entry was added.
	// the second time it's called, we get a new value for mary-prime
	expect(set).toHaveBeenCalledWith({
		viewer: {
			id: '1',
			friends: [],
		},
	})
})

test('can toggle records', function () {
	// instantiate a cache
	const cache = testCache()

	// create a list we will add to
	cache._internal_unstable.write({
		selection: {
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
		},
		data: {
			viewer: {
				id: '1',
				friends: [{ id: '5' }],
			},
		},
	})

	// subscribe to the data to register the list
	cache._internal_unstable.subscribe(
		{
			rootType: 'User',
			selection: {
				fields: {
					friends: {
						type: 'User',
						visible: true,
						keyRaw: 'friends',
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
			parentID: cache._internal_unstable._internal_unstable.id('User', '1')!,
			set: vi.fn(),
		},
		{}
	)

	// grab a reference to a user that
	const targetUser = cache.get('User', { id: '3' })

	// grab the list we are going to manipulate
	const list = cache.list('All_Users')

	list.toggle('first', targetUser)
	expect([...list]).toEqual(['User:3', 'User:5'])

	// toggle the user again to remove the user
	list.toggle('first', targetUser)
	expect([...list]).toEqual(['User:5'])

	// toggle the user again to add the user back
	list.toggle('last', targetUser)
	expect([...list]).toEqual(['User:5', 'User:3'])
})

test('can remove record from all lists', function () {
	// instantiate a cache
	const cache = testCache()

	// create a list we will add to
	cache._internal_unstable.write({
		selection: {
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
		},
		data: {
			viewer: {
				id: '1',
				friends: [{ id: '2', firstName: 'jane' }],
			},
		},
	})

	// subscribe to the data to register the list
	cache._internal_unstable.subscribe(
		{
			rootType: 'User',
			selection: {
				fields: {
					friends: {
						type: 'User',
						visible: true,
						keyRaw: 'friends',
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
			parentID: cache._internal_unstable._internal_unstable.id('User', '1')!,
			set: vi.fn(),
		},
		{}
	)

	// make sure we removed the element from the list
	expect([...cache.list('All_Users')]).toHaveLength(1)

	// remove the user
	cache.get('User', { id: '2' }).delete()

	expect(
		cache._internal_unstable._internal_unstable.storage.topLayer.operations['User:2'].deleted
	).toBeTruthy()
	expect([...cache.list('All_Users')]).toHaveLength(0)
})

test('list operations fail silently if there is no matching list', function () {
	const cache = testCache()
	const user = cache.get('User', { id: '1' })
	expect(() => cache.list('All_Pets')).not.toThrow()
})
