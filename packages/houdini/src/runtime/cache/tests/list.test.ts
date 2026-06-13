import { test, expect, vi } from 'vitest'

import { testConfigFile } from '../../../test/index.js'
import type { SubscriptionSelection } from '../../types.js'
import { RefetchUpdateMode } from '../../types.js'
import { Cache } from '../index.js'
import { opaqueListID } from '../lists.js'

const config = testConfigFile()

test('prepend linked lists update', () => {
	// instantiate the cache
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
							updates: [RefetchUpdateMode.prepend],
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

	// add some data to the cache
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
						firstName: 'mary',
					},
				],
			},
		},
		applyUpdates: ['prepend'],
	})

	// make sure we can get the linked lists back
	expect(
		cache.read({
			selection: {
				fields: {
					friends: {
						type: 'User',
						visible: true,
						keyRaw: 'friends',
						updates: [RefetchUpdateMode.prepend],
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
			parent: 'User:1',
		}).data
	).toEqual({
		friends: [
			{
				id: '2',
				firstName: 'jane',
			},
			{
				id: '3',
				firstName: 'mary',
			},
		],
	})
	// add some data to the cache
	cache.write({
		selection,
		data: {
			viewer: {
				id: '1',
				firstName: 'bob',
				friends: [
					{
						id: '4',
						firstName: 'jane',
					},
					{
						id: '5',
						firstName: 'mary',
					},
				],
			},
		},
		applyUpdates: ['prepend'],
	})

	// make sure we can get the linked lists back
	expect(
		cache.read({
			selection: {
				fields: {
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
			parent: 'User:1',
		}).data
	).toEqual({
		friends: [
			{
				id: '4',
				firstName: 'jane',
			},
			{
				id: '5',
				firstName: 'mary',
			},
			{
				id: '2',
				firstName: 'jane',
			},
			{
				id: '3',
				firstName: 'mary',
			},
		],
	})
})

test('append in list', () => {
	// instantiate a cache
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
				],
			},
		},
	})

	// a function to spy on that will play the role of set
	const set = vi.fn()

	// subscribe to the fields
	cache.subscribe({
		rootType: 'Query',
		onMessage: set,
		selection,
	})

	// insert an element into the list (no parent ID)
	cache.list('All_Users').append({
		selection: {
			fields: {
				id: { visible: true, type: 'ID', keyRaw: 'id' },
				firstName: { visible: true, type: 'String', keyRaw: 'firstName' },
			},
		},
		data: {
			id: '3',
			firstName: 'mary',
		},
	})

	// make sure we got the new value
	expect(set).toHaveBeenCalledWith({
		kind: 'update',
		data: {
			viewer: {
				id: '1',
				friends: [
					{
						firstName: 'jane',
						id: '2',
					},
					{
						firstName: 'mary',
						id: '3',
					},
				],
			},
		},
	})
})

test('prepend in list', () => {
	// instantiate a cache
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
				],
			},
		},
	})

	// a function to spy on that will play the role of set
	const set = vi.fn()

	// subscribe to the fields
	cache.subscribe({
		rootType: 'Query',
		onMessage: set,
		selection,
	})

	// insert an element into the list (no parent ID)
	cache.list('All_Users').prepend({
		selection: {
			fields: {
				id: { visible: true, type: 'ID', keyRaw: 'id' },
				firstName: { visible: true, type: 'String', keyRaw: 'firstName' },
			},
		},
		data: {
			id: '3',
			firstName: 'mary',
		},
	})

	// make sure we got the new value
	expect(set).toHaveBeenCalledWith({
		kind: 'update',
		data: {
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
		},
	})
})

test('remove from connection', () => {
	// instantiate a cache
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
							list: {
								name: 'All_Users',
								connection: true,
								type: 'User',
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
	cache.write({
		selection,
		data: {
			viewer: {
				id: '1',
				friends: {
					edges: [
						{
							node: {
								__typename: 'User',
								id: '2',
								firstName: 'jane',
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
	cache.subscribe({
		rootType: 'Query',
		onMessage: set,
		selection,
	})

	// remove user 2 from the list
	cache.list('All_Users').remove({
		id: '2',
	})

	// the first time set was called, a new entry was added.
	// the second time it's called, we get a new value for mary-prime
	expect(set).toHaveBeenCalledWith({
		kind: 'update',
		data: {
			viewer: {
				id: '1',
				friends: {
					edges: [
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

	// make sure we aren't subscribing to user 2 any more
	expect(cache._internal_unstable.subscriptions.get('User:2', 'firstName')).toHaveLength(0)
	// but we're still subscribing to user 3
	expect(cache._internal_unstable.subscriptions.get('User:3', 'firstName')).toHaveLength(1)
})

test('element removed from list can be added back', () => {
	// instantiate a cache
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
							list: {
								name: 'All_Users',
								connection: true,
								type: 'User',
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
	cache.write({
		selection,
		data: {
			viewer: {
				id: '1',
				friends: {
					edges: [
						{
							node: {
								__typename: 'User',
								id: '2',
								firstName: 'jane2',
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
	cache.subscribe({
		rootType: 'Query',
		onMessage: set,
		selection,
	})

	// remove user 2 from the list
	cache.list('All_Users').remove({
		id: '2',
	})

	cache.list('All_Users').append({
		selection: {
			fields: {
				id: {
					keyRaw: 'id',
					type: 'String',
					visible: true,
				},
				firstName: {
					keyRaw: 'firstName',
					type: 'String',
					visible: true,
				},
			},
		},
		data: {
			__typename: 'User',
			id: '2',
			firstName: 'jane2',
		},
	})

	expect(set).toHaveBeenNthCalledWith(2, {
		kind: 'update',
		data: {
			viewer: {
				id: '1',
				friends: {
					edges: [
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
								id: '2',
								firstName: 'jane2',
							},
						},
					],
				},
			},
		},
	})
})

test('append in connection', () => {
	// instantiate a cache
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
							list: {
								name: 'All_Users',
								connection: true,
								type: 'User',
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
	cache.write({
		selection,
		data: {
			viewer: {
				id: '1',
				friends: {
					edges: [
						{
							node: {
								__typename: 'User',
								id: '2',
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
	cache.subscribe({
		rootType: 'Query',
		onMessage: set,
		selection,
	})

	// insert an element into the list (no parent ID)
	cache.list('All_Users').append({
		selection: {
			fields: {
				id: { visible: true, type: 'ID', keyRaw: 'id' },
				firstName: { visible: true, type: 'String', keyRaw: 'firstName' },
			},
		},
		data: {
			id: '3',
			firstName: 'mary',
		},
	})

	// make sure we got the new value
	expect(set).toHaveBeenCalledWith({
		kind: 'update',
		data: {
			viewer: {
				id: '1',
				friends: {
					edges: [
						{
							node: {
								__typename: 'User',
								id: '2',
								firstName: 'jane',
							},
						},
						{
							node: {
								__typename: 'User',
								id: '3',
								firstName: 'mary',
							},
						},
					],
				},
			},
		},
	})
})

test("prepending update doesn't overwrite endCursor and hasNext Page", () => {
	// instantiate a cache
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
							list: {
								name: 'All_Users',
								connection: true,
								type: 'User',
							},
							selection: {
								fields: {
									pageInfo: {
										type: 'PageInfo',
										visible: true,
										keyRaw: 'pageInfo',
										selection: {
											fields: {
												hasNextPage: {
													type: 'Boolean',
													visible: true,
													keyRaw: 'hasNextPage',
													updates: ['append'],
												},
												hasPreviousPage: {
													type: 'Boolean',
													visible: true,
													keyRaw: 'hasPreviousPage',
													updates: ['prepend'],
												},
												startCursor: {
													type: 'String',
													visible: true,
													keyRaw: 'startCursor',
													updates: ['prepend'],
												},
												endCursor: {
													type: 'String',
													visible: true,
													keyRaw: 'endCursor',
													updates: ['append'],
												},
											},
										},
									},
									edges: {
										type: 'UserEdge',
										visible: true,
										keyRaw: 'edges',
										updates: ['prepend'],
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

	// write the cached data once
	cache.write({
		selection,
		data: {
			viewer: {
				id: '1',
				friends: {
					pageInfo: {
						hasPreviousPage: true,
						hasNextPage: true,
						startCursor: 'a',
						endCursor: 'b',
					},
					edges: [
						{
							node: {
								__typename: 'User',
								id: '2',
								firstName: 'jane2',
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

	// write it again with a prepend update to insert the user
	cache.write({
		selection,
		applyUpdates: ['prepend'],
		data: {
			viewer: {
				id: '1',
				friends: {
					pageInfo: {
						// should have a different value for the initial set
						// so we can confirm that it only picked up the starting keys
						hasPreviousPage: false,
						hasNextPage: false,
						startCursor: 'aa',
						endCursor: 'bb',
					},
					edges: [
						{
							node: {
								__typename: 'User',
								id: '4',
								firstName: 'jane3',
							},
						},
					],
				},
			},
		},
	})

	// make sure that the data looks good
	expect(cache.read({ selection })).toEqual({
		partial: false,
		stale: false,
		data: {
			viewer: {
				id: '1',
				friends: {
					pageInfo: {
						hasPreviousPage: false,
						hasNextPage: true,
						startCursor: 'aa',
						endCursor: 'b',
					},
					edges: [
						{
							node: {
								__typename: 'User',
								id: '4',
								firstName: 'jane3',
							},
						},
						{
							node: {
								__typename: 'User',
								id: '2',
								firstName: 'jane2',
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
})

test("append update doesn't overwrite startCursor and hasPrevious Page", () => {
	// instantiate a cache
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
							list: {
								name: 'All_Users',
								connection: true,
								type: 'User',
							},
							selection: {
								fields: {
									pageInfo: {
										type: 'PageInfo',
										visible: true,
										keyRaw: 'pageInfo',
										selection: {
											fields: {
												hasNextPage: {
													type: 'Boolean',
													visible: true,
													keyRaw: 'hasNextPage',
													updates: ['append'],
												},
												hasPreviousPage: {
													type: 'Boolean',
													visible: true,
													keyRaw: 'hasPreviousPage',
													updates: ['prepend'],
												},
												startCursor: {
													type: 'String',
													visible: true,
													keyRaw: 'startCursor',
													updates: ['prepend'],
												},
												endCursor: {
													type: 'String',
													visible: true,
													keyRaw: 'endCursor',
													updates: ['append'],
												},
											},
										},
									},
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

	// write the cached data once
	cache.write({
		selection,
		data: {
			viewer: {
				id: '1',
				friends: {
					pageInfo: {
						hasPreviousPage: true,
						hasNextPage: true,
						startCursor: 'a',
						endCursor: 'b',
					},
					edges: [
						{
							node: {
								__typename: 'User',
								id: '2',
								firstName: 'jane2',
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

	// write it again with a prepend update to insert the user
	cache.write({
		selection,
		applyUpdates: ['append'],
		data: {
			viewer: {
				id: '1',
				friends: {
					pageInfo: {
						// should have a different value for the initial set
						// so we can confirm that it only picked up the starting keys
						hasPreviousPage: false,
						hasNextPage: false,
						startCursor: 'aa',
						endCursor: 'bb',
					},
					edges: [
						{
							node: {
								__typename: 'User',
								id: '4',
								firstName: 'jane3',
							},
						},
					],
				},
			},
		},
	})

	// make sure that the data looks good
	expect(cache.read({ selection })).toEqual({
		partial: false,
		stale: false,
		data: {
			viewer: {
				id: '1',
				friends: {
					pageInfo: {
						hasPreviousPage: true,
						hasNextPage: false,
						startCursor: 'a',
						endCursor: 'bb',
					},
					edges: [
						{
							node: {
								__typename: 'User',
								id: '2',
								firstName: 'jane2',
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
								firstName: 'jane3',
							},
						},
					],
				},
			},
		},
	})
})

test('forward-only append preserves hasPreviousPage', () => {
	// forward-only cursor pagination: hasPreviousPage carries updates:["prepend"]
	// so the runtime gate fires on append and keeps the accumulated false,
	// even though the server returns true for intermediate pages.
	const cache = new Cache(config)

	const selection: SubscriptionSelection = {
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
							list: { name: 'All_Users', connection: true, type: 'User' },
							selection: {
								fields: {
									pageInfo: {
										type: 'PageInfo',
										visible: true,
										keyRaw: 'pageInfo',
										selection: {
											fields: {
												hasNextPage: {
													type: 'Boolean',
													visible: true,
													keyRaw: 'hasNextPage',
													updates: ['append'],
												},
												hasPreviousPage: {
													type: 'Boolean',
													visible: true,
													keyRaw: 'hasPreviousPage',
													updates: ['prepend'],
												},
												startCursor: {
													type: 'String',
													visible: true,
													keyRaw: 'startCursor',
												},
												endCursor: {
													type: 'String',
													visible: true,
													keyRaw: 'endCursor',
													updates: ['append'],
												},
											},
										},
									},
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

	// write the first page (start of list, hasPreviousPage is false)
	cache.write({
		selection,
		data: {
			viewer: {
				id: '1',
				friends: {
					pageInfo: {
						hasPreviousPage: false,
						hasNextPage: true,
						startCursor: 'a',
						endCursor: 'b',
					},
					edges: [{ node: { __typename: 'User', id: '2', firstName: 'jane' } }],
				},
			},
		},
	})

	// append the second page — server correctly reports hasPreviousPage:true for this
	// page, but the accumulated view must keep false
	cache.write({
		selection,
		applyUpdates: ['append'],
		data: {
			viewer: {
				id: '1',
				friends: {
					pageInfo: {
						hasPreviousPage: true,
						hasNextPage: false,
						startCursor: 'b',
						endCursor: 'c',
					},
					edges: [{ node: { __typename: 'User', id: '3', firstName: 'bob' } }],
				},
			},
		},
	})

	expect(cache.read({ selection })).toEqual({
		partial: false,
		stale: false,
		data: {
			viewer: {
				id: '1',
				friends: {
					pageInfo: {
						hasPreviousPage: false, // preserved — accumulated list starts at page 1
						hasNextPage: false, // updated — no more forward pages
						startCursor: 'b', // updated — no gate on startCursor in forward-only
						endCursor: 'c', // updated — moved to end of new page
					},
					edges: [
						{ node: { __typename: 'User', id: '2', firstName: 'jane' } },
						{ node: { __typename: 'User', id: '3', firstName: 'bob' } },
					],
				},
			},
		},
	})
})

test('backward-only prepend preserves hasNextPage and endCursor', () => {
	// backward-only cursor pagination: hasNextPage and endCursor carry updates:["append"]
	// so the runtime gate fires on prepend and keeps the accumulated false/null,
	// even though the server returns values for intermediate pages.
	const cache = new Cache(config)

	const selection: SubscriptionSelection = {
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
							list: { name: 'All_Users', connection: true, type: 'User' },
							selection: {
								fields: {
									pageInfo: {
										type: 'PageInfo',
										visible: true,
										keyRaw: 'pageInfo',
										selection: {
											fields: {
												hasNextPage: {
													type: 'Boolean',
													visible: true,
													keyRaw: 'hasNextPage',
													updates: ['append'],
												},
												hasPreviousPage: {
													type: 'Boolean',
													visible: true,
													keyRaw: 'hasPreviousPage',
													updates: ['prepend'],
												},
												startCursor: {
													type: 'String',
													visible: true,
													keyRaw: 'startCursor',
													updates: ['prepend'],
												},
												endCursor: {
													type: 'String',
													visible: true,
													keyRaw: 'endCursor',
												},
											},
										},
									},
									edges: {
										type: 'UserEdge',
										visible: true,
										keyRaw: 'edges',
										updates: ['prepend'],
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

	// write the last page (end of list, hasNextPage is false)
	cache.write({
		selection,
		data: {
			viewer: {
				id: '1',
				friends: {
					pageInfo: {
						hasPreviousPage: true,
						hasNextPage: false,
						startCursor: 'b',
						endCursor: 'c',
					},
					edges: [{ node: { __typename: 'User', id: '3', firstName: 'bob' } }],
				},
			},
		},
	})

	// prepend the previous page — server correctly reports hasNextPage:true for this
	// page, but the accumulated view must keep false
	cache.write({
		selection,
		applyUpdates: ['prepend'],
		data: {
			viewer: {
				id: '1',
				friends: {
					pageInfo: {
						hasPreviousPage: false,
						hasNextPage: true,
						startCursor: 'a',
						endCursor: 'b',
					},
					edges: [{ node: { __typename: 'User', id: '2', firstName: 'jane' } }],
				},
			},
		},
	})

	expect(cache.read({ selection })).toEqual({
		partial: false,
		stale: false,
		data: {
			viewer: {
				id: '1',
				friends: {
					pageInfo: {
						hasPreviousPage: false, // updated — no more backward pages
						hasNextPage: false, // preserved — accumulated list ends at last page
						startCursor: 'a', // updated — moved to start of new page
						endCursor: 'b', // updated — no gate on endCursor in backward-only
					},
					edges: [
						{ node: { __typename: 'User', id: '2', firstName: 'jane' } },
						{ node: { __typename: 'User', id: '3', firstName: 'bob' } },
					],
				},
			},
		},
	})
})

test('append in connection', () => {
	// instantiate a cache
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
							list: {
								name: 'All_Users',
								connection: true,
								type: 'User',
							},
							selection: {
								fields: {
									edges: {
										type: 'UserEdge',
										visible: true,
										keyRaw: 'edges',
										selection: {
											fields: {
												__typename: {
													type: 'String',
													visible: true,
													keyRaw: '__typename',
												},
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
	cache.write({
		selection,
		data: {
			viewer: {
				id: '1',
				friends: {
					edges: [
						{
							__typename: 'UserEdge',
							node: {
								__typename: 'User',
								id: '2',
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
	cache.subscribe({
		rootType: 'Query',
		onMessage: set,
		selection,
	})

	// insert an element into the list (no parent ID)
	cache.list('All_Users').append({
		selection: {
			fields: {
				id: { visible: true, type: 'ID', keyRaw: 'id' },
				firstName: { visible: true, type: 'String', keyRaw: 'firstName' },
			},
		},
		data: {
			id: '3',
			firstName: 'mary',
		},
	})

	// make sure we got the new value
	expect(set).toHaveBeenCalledWith({
		kind: 'update',
		data: {
			viewer: {
				id: '1',
				friends: {
					edges: [
						{
							__typename: 'UserEdge',
							node: {
								__typename: 'User',
								id: '2',
								firstName: 'jane',
							},
						},
						{
							__typename: 'UserEdge',
							node: {
								__typename: 'User',
								id: '3',
								firstName: 'mary',
							},
						},
					],
				},
			},
		},
	})

	// make sure we set an typename on the edge (so it has a value when we read back)
	expect(
		cache.read({
			selection,
		})
	).toEqual({
		data: {
			viewer: {
				id: '1',
				friends: {
					edges: [
						{
							__typename: 'UserEdge',
							node: {
								__typename: 'User',
								id: '2',
								firstName: 'jane',
							},
						},
						{
							__typename: 'UserEdge',
							node: {
								__typename: 'User',
								id: '3',
								firstName: 'mary',
							},
						},
					],
				},
			},
		},
		partial: false,
		stale: false,
	})
})

test('inserting data with an update overwrites a record inserted with list.append', () => {
	// instantiate a cache
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
							list: {
								name: 'All_Users',
								connection: true,
								type: 'User',
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

	// start off associated with just one object
	cache.write({
		selection,
		data: {
			viewer: {
				id: '1',
				friends: {
					edges: [
						{
							node: {
								__typename: 'User',
								id: '2',
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
	cache.subscribe({
		rootType: 'Query',
		onMessage: set,
		selection,
	})

	// insert an element into the list (no parent ID)
	cache.list('All_Users').append({
		selection: {
			fields: {
				id: { visible: true, type: 'ID', keyRaw: 'id' },
				firstName: { visible: true, type: 'String', keyRaw: 'firstName' },
			},
		},
		data: {
			id: '3',
			firstName: 'mary',
		},
	})

	// insert a record with a query update
	cache.write({
		applyUpdates: [RefetchUpdateMode.append],
		data: {
			viewer: {
				id: '1',
				firstName: 'John',
				friends: {
					edges: [
						{
							cursor: '1234',
							node: {
								__typename: 'User',
								id: '3',
								firstName: 'mary',
							},
						},
					],
				},
			},
		},
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
							firstName: {
								type: 'String',
								visible: true,
								keyRaw: 'firstName',
							},
							friends: {
								type: 'User',
								visible: true,
								keyRaw: 'friends',
								selection: {
									fields: {
										edges: {
											type: 'UserEdge',
											visible: true,
											keyRaw: 'edges',
											updates: [RefetchUpdateMode.append],
											selection: {
												fields: {
													cursor: {
														type: 'String',
														visible: true,
														keyRaw: 'cursor',
													},
													node: {
														type: 'User',
														visible: true,
														keyRaw: 'node',
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
		},
	})

	// make sure the duplicate has been removed
	expect(set).toHaveBeenNthCalledWith(2, {
		kind: 'update',
		data: {
			viewer: {
				id: '1',
				friends: {
					edges: [
						{
							node: {
								__typename: 'User',
								id: '2',
								firstName: 'jane',
							},
						},
						{
							node: {
								__typename: 'User',
								id: '3',
								firstName: 'mary',
							},
						},
					],
				},
			},
		},
	})

	expect(
		cache.read({
			selection,
		})
	).toEqual({
		data: {
			viewer: {
				friends: {
					edges: [
						{
							node: {
								__typename: 'User',
								firstName: 'jane',
								id: '2',
							},
						},
						{
							node: {
								__typename: 'User',
								firstName: 'mary',
								id: '3',
							},
						},
					],
				},
				id: '1',
			},
		},
		partial: false,
		stale: false,
	})
})

test('list filter - must_not positive', () => {
	// instantiate a cache
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
				],
			},
		},
	})

	// a function to spy on that will play the role of set
	const set = vi.fn()

	// subscribe to the fields
	cache.subscribe({
		rootType: 'Query',
		onMessage: set,
		selection,
	})

	// insert an element into the list (no parent ID)
	cache
		.list('All_Users')
		.when({ must_not: { foo: 'not-bar' } })
		.prepend({
			selection: {
				fields: {
					id: { visible: true, type: 'ID', keyRaw: 'id' },
					firstName: { visible: true, type: 'String', keyRaw: 'firstName' },
				},
			},
			data: {
				id: '3',
				firstName: 'mary',
			},
		})

	// make sure we got the new value
	expect(set).toHaveBeenCalledWith({
		kind: 'update',
		data: {
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
		},
	})
})

test('list filter - must_not negative', () => {
	// instantiate a cache
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
				],
			},
		},
	})

	// a function to spy on that will play the role of set
	const set = vi.fn()

	// subscribe to the fields
	cache.subscribe({
		rootType: 'Query',
		onMessage: set,
		selection,
	})

	// insert an element into the list (no parent ID)
	cache
		.list('All_Users')
		.when({ must_not: { foo: 'bar' } })
		.prepend({
			selection: {
				fields: {
					id: { visible: true, type: 'ID', keyRaw: 'id' },
					firstName: { visible: true, type: 'String', keyRaw: 'firstName' },
				},
			},
			data: {
				id: '3',
				firstName: 'mary',
			},
		})

	// make sure we got the new value
	expect(set).not.toHaveBeenCalled()
})

test('list filter - must positive', () => {
	// instantiate a cache
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
				],
			},
		},
	})

	// a function to spy on that will play the role of set
	const set = vi.fn()

	// subscribe to the fields
	cache.subscribe({
		rootType: 'Query',
		onMessage: set,
		selection,
	})

	// insert an element into the list (no parent ID)
	cache
		.list('All_Users')
		.when({ must: { foo: 'bar' } })
		.prepend({
			selection: {
				fields: {
					id: { visible: true, type: 'ID', keyRaw: 'id' },
					firstName: { visible: true, type: 'String', keyRaw: 'firstName' },
				},
			},
			data: {
				id: '3',
				firstName: 'mary',
			},
		})

	// make sure we got the new value
	expect(set).toHaveBeenCalledWith({
		kind: 'update',
		data: {
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
		},
	})
})

test('list filter - must negative', () => {
	// instantiate a cache
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
				],
			},
		},
	})

	// a function to spy on that will play the role of set
	const set = vi.fn()

	// subscribe to the fields
	cache.subscribe({
		rootType: 'Query',
		onMessage: set,
		selection,
	})

	// insert an element into the list (no parent ID)
	cache
		.list('All_Users')
		.when({ must: { foo: 'not-bar' } })
		.prepend({
			selection: {
				fields: {
					id: { visible: true, type: 'ID', keyRaw: 'id' },
					firstName: { visible: true, type: 'String', keyRaw: 'firstName' },
				},
			},
			data: {
				id: '3',
				firstName: 'mary',
			},
		})

	// make sure we got the new value
	expect(set).not.toHaveBeenCalled()
})

test('list filter - object value with nested variable', () => {
	// instantiate a cache
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
							list: {
								name: 'All_Users',
								connection: false,
								type: 'User',
							},
							filters: {
								filter: {
									kind: 'Object',
									value: {
										name: {
											kind: 'Variable',
											value: 'value',
										},
									},
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
				],
			},
		},
		variables: { value: 'bar' },
	})

	// a function to spy on that will play the role of set
	const set = vi.fn()

	// subscribe to the fields
	cache.subscribe(
		{
			rootType: 'Query',
			onMessage: (msg) => {
				if (msg.kind === 'update') set(msg.data)
			},
			selection,
		},
		{ value: 'bar' }
	)

	const insert = (id: string, name: string) =>
		cache
			.list('All_Users')
			.when({ must: { filter: { name } } })
			.prepend({
				selection: {
					fields: {
						id: { visible: true, type: 'ID', keyRaw: 'id' },
						firstName: { visible: true, type: 'String', keyRaw: 'firstName' },
					},
				},
				data: {
					id,
					firstName: 'mary',
				},
			})

	// a when condition that matches the resolved object filter applies
	insert('3', 'bar')
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

	// one that doesn't match is skipped
	set.mockClear()
	insert('4', 'not-bar')
	expect(set).not.toHaveBeenCalled()
})

test('remove from list', () => {
	// instantiate a cache
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
				],
			},
		},
	})

	// a function to spy on that will play the role of set
	const set = vi.fn()

	// subscribe to the fields
	cache.subscribe({
		rootType: 'Query',
		onMessage: set,
		selection,
	})

	// remove user 2 from the list
	cache.list('All_Users').remove({
		id: '2',
	})

	// the first time set was called, a new entry was added.
	// the second time it's called, we get a new value for mary-prime
	expect(set).toHaveBeenCalledWith({
		kind: 'update',
		data: {
			viewer: {
				id: '1',
				friends: [],
			},
		},
	})

	// make sure we aren't subscribing to user 2 any more
	expect(cache._internal_unstable.subscriptions.get('User:2', 'firstName')).toHaveLength(0)
})

test('delete node', () => {
	// instantiate a cache
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
				],
			},
		},
	})

	// a function to spy on that will play the role of set
	const set = vi.fn()

	// subscribe to the fields
	cache.subscribe({
		rootType: 'Query',
		onMessage: set,
		selection,
	})

	// remove user 2 from the list
	cache.delete(
		cache._internal_unstable.id('User', {
			id: '2',
		})!
	)

	// we should have been updated with an empty list
	expect(set).toHaveBeenCalledWith({
		kind: 'update',
		data: {
			viewer: {
				id: '1',
				friends: [],
			},
		},
	})

	// make sure its empty now
	expect(cache._internal_unstable.storage.topLayer.operations['User:2'].deleted).toBeTruthy()
})

test('delete node from connection', () => {
	// instantiate a cache
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
							list: {
								name: 'All_Users',
								connection: true,
								type: 'User',
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
	cache.write({
		selection,
		data: {
			viewer: {
				id: '1',
				friends: {
					edges: [
						{
							node: {
								__typename: 'User',
								id: '2',
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
	cache.subscribe({
		rootType: 'Query',
		onMessage: set,
		selection,
	})

	// remove user 2 from the list
	cache.delete(
		cache._internal_unstable.id('User', {
			id: '2',
		})!
	)

	// we should have been updated with an empty list
	expect(set).toHaveBeenCalledWith({
		kind: 'update',
		data: {
			viewer: {
				id: '1',
				friends: {
					edges: [],
				},
			},
		},
	})

	// make sure its empty now
	expect(cache._internal_unstable.storage.topLayer.operations['User:2'].deleted).toBeTruthy()
})

test('append operation', () => {
	// instantiate a cache
	const cache = new Cache(config)

	// create a list we will add to
	cache.write({
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
						},
					},
				},
			},
		},
		data: {
			viewer: {
				id: '1',
			},
		},
	})

	// subscribe to the data to register the list
	cache.subscribe(
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
			parentID: cache._internal_unstable.id('User', '1')!,
			onMessage: vi.fn(),
		},
		{}
	)

	// write some data to a different location with a new user
	// that should be added to the list
	cache.write({
		selection: {
			fields: {
				newUser: {
					type: 'User',
					visible: true,
					keyRaw: 'newUser',
					operations: [
						{
							action: 'insert',
							list: 'All_Users',
						},
					],
					selection: {
						fields: {
							id: {
								type: 'ID',
								visible: true,
								keyRaw: 'id',
							},
						},
					},
				},
			},
		},
		data: {
			newUser: {
				id: '3',
			},
		},
	})

	// make sure we just added to the list
	expect([...cache.list('All_Users', '1')]).toHaveLength(1)
})

test('append from list', () => {
	// instantiate a cache
	const cache = new Cache(config)

	// create a list we will add to
	cache.write({
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
						},
					},
				},
			},
		},
		data: {
			viewer: {
				id: '1',
			},
		},
	})

	// subscribe to the data to register the list
	cache.subscribe(
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
			parentID: cache._internal_unstable.id('User', '1')!,
			onMessage: vi.fn(),
		},
		{}
	)

	// write some data to a different location with a new user
	// that should be added to the list
	cache.write({
		selection: {
			fields: {
				newUser: {
					type: 'User',
					visible: true,
					keyRaw: 'newUser',
					operations: [
						{
							action: 'insert',
							list: 'All_Users',
						},
					],
					selection: {
						fields: {
							id: {
								type: 'ID',
								visible: true,
								keyRaw: 'id',
							},
						},
					},
				},
			},
		},
		data: {
			newUser: [{ id: '3' }, { id: '4' }],
		},
	})

	// make sure we just added to the list
	expect([...cache.list('All_Users', '1')]).toHaveLength(2)
})

test('toggle list', () => {
	// instantiate a cache
	const cache = new Cache(config)

	// create a list we will add to
	cache.write({
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
	cache.subscribe(
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
			parentID: cache._internal_unstable.id('User', '1')!,
			onMessage: vi.fn(),
		},
		{}
	)

	const toggleSelection: SubscriptionSelection = {
		fields: {
			newUser: {
				type: 'User',
				visible: true,
				keyRaw: 'newUser',
				operations: [
					{
						action: 'toggle',
						list: 'All_Users',
					},
				],
				selection: {
					fields: {
						id: {
							type: 'ID',
							visible: true,
							keyRaw: 'id',
						},
					},
				},
			},
		},
	}

	// write some data to a different location with a new user
	// that should be added to the list
	cache.write({ selection: toggleSelection, data: { newUser: { id: '3' } } })
	expect([...cache.list('All_Users', '1')]).toEqual(['User:5', 'User:3'])

	// toggle the user again to remove the user
	cache.write({ selection: toggleSelection, data: { newUser: { id: '3' } } })
	expect([...cache.list('All_Users', '1')]).toEqual(['User:5'])

	// toggle the user again to add the user back
	cache.write({ selection: toggleSelection, data: { newUser: { id: '3' } } })
	expect([...cache.list('All_Users', '1')]).toEqual(['User:5', 'User:3'])
})

test('toggle list survives multiple on-off cycles through mutation layers', () => {
	const cache = new Cache(config)

	// shared selections
	const friendsSelection: SubscriptionSelection = {
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
						id: { type: 'ID', visible: true, keyRaw: 'id' },
					},
				},
			},
		},
	}

	const toggleSelection: SubscriptionSelection = {
		fields: {
			newUser: {
				type: 'User',
				visible: true,
				keyRaw: 'newUser',
				operations: [{ action: 'toggle', list: 'All_Users' }],
				selection: {
					fields: {
						id: { type: 'ID', visible: true, keyRaw: 'id' },
					},
				},
			},
		},
	}

	// write the initial query result and subscribe so the list is registered
	cache.write({
		selection: {
			fields: {
				viewer: {
					type: 'User',
					visible: true,
					keyRaw: 'viewer',
					selection: friendsSelection,
				},
			},
		},
		data: { viewer: { id: '1', friends: [] } },
	})

	cache.subscribe(
		{
			rootType: 'User',
			selection: friendsSelection,
			parentID: cache._internal_unstable.id('User', '1')!,
			onMessage: vi.fn(),
		},
		{}
	)

	// simulate a mutation by writing through an optimistic layer then resolving it,
	// matching the lifecycle the mutation plugin uses in production
	const mutate = (data: Record<string, unknown>) => {
		const layer = cache._internal_unstable.storage.createLayer(true)
		cache.write({ selection: toggleSelection, data, layer: layer.id })
		cache._internal_unstable.storage.resolveLayer(layer.id)
	}

	// cycle 1 — on
	mutate({ newUser: { id: '3' } })
	expect([...cache.list('All_Users', '1')]).toEqual(['User:3'])

	// cycle 1 — off
	mutate({ newUser: { id: '3' } })
	expect([...cache.list('All_Users', '1')]).toEqual([])

	// cycle 2 — on (this is where the stale remove op used to re-cancel the insert)
	mutate({ newUser: { id: '3' } })
	expect([...cache.list('All_Users', '1')]).toEqual(['User:3'])

	// cycle 2 — off
	mutate({ newUser: { id: '3' } })
	expect([...cache.list('All_Users', '1')]).toEqual([])

	// cycle 3 — on
	mutate({ newUser: { id: '3' } })
	expect([...cache.list('All_Users', '1')]).toEqual(['User:3'])
})

test('append when operation', () => {
	// instantiate a cache
	const cache = new Cache(config)

	// create a list we will add to
	cache.write({
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
						},
					},
				},
			},
		},
		data: {
			viewer: {
				id: '1',
			},
		},
	})

	// subscribe to the data to register the list
	cache.subscribe(
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
						filters: {
							value: {
								kind: 'String',
								value: 'foo',
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
			parentID: cache._internal_unstable.id('User', '1')!,
			onMessage: vi.fn(),
		},
		{}
	)

	// write some data to a different location with a new user
	// that should be added to the list
	cache.write({
		selection: {
			fields: {
				newUser: {
					type: 'User',
					visible: true,
					keyRaw: 'newUser',
					operations: [
						{
							action: 'insert',
							list: 'All_Users',
							when: {
								must: {
									value: {
										kind: 'String',
										value: 'not-foo',
									},
								},
							},
						},
					],
					selection: {
						fields: {
							id: {
								type: 'ID',
								visible: true,
								keyRaw: 'id',
							},
						},
					},
				},
			},
		},
		data: {
			newUser: {
				id: '3',
			},
		},
	})

	// make sure we just added to the list
	expect([...cache.list('All_Users', '1')]).toHaveLength(0)
})

test('when operation with variable condition', () => {
	// instantiate a cache
	const cache = new Cache(config)

	// create a list we will add to
	cache.write({
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
						},
					},
				},
			},
		},
		data: {
			viewer: {
				id: '1',
			},
		},
	})

	// subscribe to the data to register the list
	cache.subscribe(
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
						filters: {
							value: {
								kind: 'String',
								value: 'foo',
							},
						},
						selection: {
							fields: {
								id: {
									type: 'ID',
									visible: true,
									keyRaw: 'id',
								},
							},
						},
					},
				},
			},
			parentID: cache._internal_unstable.id('User', '1')!,
			onMessage: vi.fn(),
		},
		{}
	)

	// the selection for a mutation whose when condition points to a variable
	const mutationSelection: SubscriptionSelection = {
		fields: {
			newUser: {
				type: 'User',
				visible: true,
				keyRaw: 'newUser',
				operations: [
					{
						action: 'insert',
						list: 'All_Users',
						when: {
							must: {
								value: {
									kind: 'Variable',
									value: 'target',
								},
							},
						},
					},
				],
				selection: {
					fields: {
						id: {
							type: 'ID',
							visible: true,
							keyRaw: 'id',
						},
					},
				},
			},
		},
	}

	// a write whose variable doesn't match the list's filters gets skipped
	cache.write({
		selection: mutationSelection,
		data: { newUser: { id: '3' } },
		variables: { target: 'not-foo' },
	})
	expect([...cache.list('All_Users', '1')]).toHaveLength(0)

	// one whose variable matches the filter applies
	cache.write({
		selection: mutationSelection,
		data: { newUser: { id: '3' } },
		variables: { target: 'foo' },
	})
	expect([...cache.list('All_Users', '1')]).toEqual(['User:3'])
})

test('prepend when operation', () => {
	// instantiate a cache
	const cache = new Cache(config)

	// create a list we will add to
	cache.write({
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
						},
					},
				},
			},
		},
		data: {
			viewer: {
				id: '1',
			},
		},
	})

	// subscribe to the data to register the list
	cache.subscribe(
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
						filters: {
							value: {
								kind: 'String',
								value: 'foo',
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
			parentID: cache._internal_unstable.id('User', '1')!,
			onMessage: vi.fn(),
		},
		{}
	)

	// write some data to a different location with a new user
	// that should be added to the list
	cache.write({
		selection: {
			fields: {
				newUser: {
					type: 'User',
					visible: true,
					keyRaw: 'newUser',
					operations: [
						{
							action: 'insert',
							list: 'All_Users',
							position: 'first',
							when: {
								must: {
									value: {
										kind: 'String',
										value: 'not-foo',
									},
								},
							},
						},
					],
					selection: {
						fields: {
							id: {
								type: 'ID',
								visible: true,
								keyRaw: 'id',
							},
						},
					},
				},
			},
		},
		data: {
			newUser: {
				id: '3',
			},
		},
	})

	// make sure we just added to the list
	expect([...cache.list('All_Users', '1')]).toHaveLength(0)
})

test('prepend operation', () => {
	// instantiate a cache
	const cache = new Cache(config)

	// create a list we will add to
	cache.write({
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
							},
						},
					},
				},
			},
		},
		data: {
			viewer: {
				id: '1',
				friends: [
					{
						id: '2',
						firstName: 'mary',
					},
				],
			},
		},
	})

	// subscribe to the data to register the list
	cache.subscribe(
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
			parentID: cache._internal_unstable.id('User', '1')!,
			onMessage: vi.fn(),
		},
		{}
	)

	// write some data to a different location with a new user
	// that should be added to the list
	cache.write({
		selection: {
			fields: {
				newUser: {
					type: 'User',
					visible: true,
					keyRaw: 'newUser',
					operations: [
						{
							action: 'insert',
							list: 'All_Users',
							position: 'first',
						},
					],
					selection: {
						fields: {
							id: {
								type: 'ID',
								visible: true,
								keyRaw: 'id',
							},
						},
					},
				},
			},
		},
		data: {
			newUser: {
				id: '3',
			},
		},
	})

	// make sure we just added to the list
	expect([...cache.list('All_Users', '1')]).toEqual(['User:3', 'User:2'])
})

test('remove operation', () => {
	// instantiate a cache
	const cache = new Cache(config)

	// create a list we will add to
	cache.write({
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
	cache.subscribe(
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
			parentID: cache._internal_unstable.id('User', '1')!,
			onMessage: vi.fn(),
		},
		{}
	)

	// write some data to a different location with a new user
	// that should be removed from the operation
	cache.write({
		selection: {
			fields: {
				newUser: {
					type: 'User',
					visible: true,
					keyRaw: 'newUser',
					operations: [
						{
							action: 'remove',
							list: 'All_Users',
						},
					],
					selection: {
						fields: {
							id: {
								type: 'ID',
								visible: true,
								keyRaw: 'id',
							},
						},
					},
				},
			},
		},
		data: {
			newUser: {
				id: '2',
			},
		},
	})

	// make sure we removed the element from the list
	expect([...cache.list('All_Users', '1')]).toHaveLength(0)
})

test('remove operation from list', () => {
	// instantiate a cache
	const cache = new Cache(config)

	// create a list we will add to
	cache.write({
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
				friends: [
					{ id: '2', firstName: 'jane' },
					{ id: '3', firstName: 'Alfred' },
				],
			},
		},
	})

	// subscribe to the data to register the list
	cache.subscribe(
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
			parentID: cache._internal_unstable.id('User', '1')!,
			onMessage: vi.fn(),
		},
		{}
	)

	// write some data to a different location with a new user
	// that should be removed from the operation
	cache.write({
		selection: {
			fields: {
				newUser: {
					type: 'User',
					visible: true,
					keyRaw: 'newUser',
					operations: [
						{
							action: 'remove',
							list: 'All_Users',
						},
					],
					selection: {
						fields: {
							id: {
								type: 'ID',
								visible: true,
								keyRaw: 'id',
							},
						},
					},
				},
			},
		},
		data: {
			newUser: [{ id: '2' }, { id: '3' }],
		},
	})

	// make sure we removed the element from the list
	expect([...cache.list('All_Users', '1')]).toHaveLength(0)
})

test('delete operation', () => {
	// instantiate a cache
	const cache = new Cache(config)

	// create a list we will add to
	cache.write({
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
	cache.subscribe(
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
			parentID: cache._internal_unstable.id('User', '1')!,
			onMessage: vi.fn(),
		},
		{}
	)

	// write some data to a different location with a new user
	// that should be added to the list
	cache.write({
		selection: {
			fields: {
				deleteUser: {
					type: 'User',
					visible: true,
					keyRaw: 'deleteUser',
					selection: {
						fields: {
							id: {
								type: 'ID',
								visible: true,
								keyRaw: 'id',
								operations: [
									{
										action: 'delete',
										type: 'User',
									},
								],
							},
						},
					},
				},
			},
		},
		data: {
			deleteUser: {
				id: '2',
			},
		},
	})

	// make sure we removed the element from the list
	expect([...cache.list('All_Users', '1')]).toHaveLength(0)

	expect(cache._internal_unstable.storage.topLayer.operations['User:2'].deleted).toBeTruthy()
})

test('delete operation with non-string id', () => {
	// instantiate a cache
	const cache = new Cache(config)

	// create a list we will add to
	cache.write({
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
				id: 1,
				friends: [{ id: '2', firstName: 'jane' }],
			},
		},
	})

	// subscribe to the data to register the list
	cache.subscribe(
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
			parentID: cache._internal_unstable.id('User', 1)!,
			onMessage: vi.fn(),
		},
		{}
	)

	// write some data to a different location with a new user
	// that should be added to the list
	cache.write({
		selection: {
			fields: {
				deleteUser: {
					type: 'User',
					visible: true,
					keyRaw: 'deleteUser',
					selection: {
						fields: {
							id: {
								type: 'ID',
								visible: true,
								keyRaw: 'id',
								operations: [
									{
										action: 'delete',
										type: 'User',
									},
								],
							},
						},
					},
				},
			},
		},
		data: {
			deleteUser: {
				id: 2,
			},
		},
	})

	// make sure we removed the element from the list
	expect([...cache.list('All_Users', '1')]).toHaveLength(0)

	expect(cache._internal_unstable.storage.topLayer.operations['User:2'].deleted).toBeTruthy()
})

test('delete operation from list', () => {
	// instantiate a cache
	const cache = new Cache(config)

	// create a list we will add to
	cache.write({
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
				friends: [
					{ id: '2', firstName: 'jane' },
					{ id: '3', firstName: 'Alfred' },
				],
			},
		},
	})

	// subscribe to the data to register the list
	cache.subscribe(
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
			parentID: cache._internal_unstable.id('User', '1')!,
			onMessage: vi.fn(),
		},
		{}
	)

	// write some data to a different location with a new user
	// that should be added to the list
	cache.write({
		selection: {
			fields: {
				deleteUser: {
					type: 'User',
					visible: true,
					keyRaw: 'deleteUser',
					selection: {
						fields: {
							id: {
								type: 'ID',
								visible: true,
								keyRaw: 'id',
								operations: [
									{
										action: 'delete',
										type: 'User',
									},
								],
							},
						},
					},
				},
			},
		},
		data: {
			deleteUser: {
				id: ['2', '3'],
			},
		},
	})

	// make sure we removed the element from the list
	expect([...cache.list('All_Users', '1')]).toHaveLength(0)

	expect(cache._internal_unstable.storage.topLayer.operations['User:2'].deleted).toBeTruthy()
	expect(cache._internal_unstable.storage.topLayer.operations['User:3'].deleted).toBeTruthy()
})

test('delete operation from connection', () => {
	// instantiate a cache
	const cache = new Cache(config)

	// create a list we will add to
	cache.write({
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
									connection: true,
									type: 'User',
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
		},
		data: {
			viewer: {
				id: '1',
				friends: {
					edges: [{ node: { id: '2', firstName: 'jane', __typename: 'User' } }],
				},
			},
		},
	})

	// subscribe to the data to register the list
	cache.subscribe(
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
							connection: true,
							type: 'User',
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
			parentID: cache._internal_unstable.id('User', '1')!,
			onMessage: vi.fn(),
		},
		{}
	)

	// write some data to a different location with a new user
	// that should be added to the list
	cache.write({
		selection: {
			fields: {
				deleteUser: {
					type: 'User',
					visible: true,
					keyRaw: 'deleteUser',
					selection: {
						fields: {
							id: {
								type: 'ID',
								visible: true,
								keyRaw: 'id',
								operations: [
									{
										action: 'delete',
										type: 'User',
									},
								],
							},
						},
					},
				},
			},
		},
		data: {
			deleteUser: {
				id: '2',
			},
		},
	})

	// make sure we removed the element from the list
	expect([...cache.list('All_Users', '1')]).toHaveLength(0)
	expect(cache._internal_unstable.storage.topLayer.operations['User:2'].deleted).toBeTruthy()
})

test('disabled linked lists update', () => {
	// instantiate the cache
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

	// add some data to the cache
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
						firstName: 'mary',
					},
				],
			},
		},
	})

	// make sure we can get the linked lists back
	expect(
		cache.read({
			selection: { fields: { friends: selection.fields!.viewer.selection!.fields!.friends } },
			parent: 'User:1',
		}).data
	).toEqual({
		friends: [
			{
				id: '2',
				firstName: 'jane',
			},
			{
				id: '3',
				firstName: 'mary',
			},
		],
	})

	// add some data to the cache
	cache.write({
		selection,
		data: {
			viewer: {
				id: '1',
				firstName: 'bob',
				friends: [
					{
						id: '3',
						firstName: 'jane',
					},
					{
						id: '4',
						firstName: 'mary',
					},
				],
			},
		},
	})

	// make sure we can get the linked lists back
	expect(
		cache.read({
			selection: { fields: { friends: selection.fields!.viewer.selection!.fields!.friends } },
			parent: 'User:1',
		}).data
	).toEqual({
		friends: [
			{
				id: '3',
				firstName: 'jane',
			},
			{
				id: '4',
				firstName: 'mary',
			},
		],
	})
})

test('append linked lists update', () => {
	// instantiate the cache
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

	// add some data to the cache
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
						firstName: 'mary',
					},
				],
			},
		},
	})

	// make sure we can get the linked lists back
	expect(
		cache.read({
			selection: { fields: { friends: selection.fields!.viewer.selection!.fields!.friends } },
			parent: 'User:1',
		}).data
	).toEqual({
		friends: [
			{
				id: '2',
				firstName: 'jane',
			},
			{
				id: '3',
				firstName: 'mary',
			},
		],
	})

	// add some data to the cache
	cache.write({
		selection,
		data: {
			viewer: {
				id: '1',
				firstName: 'bob',
				friends: [
					{
						id: '4',
						firstName: 'jane',
					},
					{
						id: '5',
						firstName: 'mary',
					},
				],
			},
		},
		applyUpdates: [RefetchUpdateMode.append],
	})

	// make sure we can get the linked lists back
	expect(
		cache.read({
			selection: { fields: { friends: selection.fields!.viewer.selection!.fields!.friends } },
			parent: 'User:1',
		}).data
	).toEqual({
		friends: [
			{
				id: '2',
				firstName: 'jane',
			},
			{
				id: '3',
				firstName: 'mary',
			},
			{
				id: '4',
				firstName: 'jane',
			},
			{
				id: '5',
				firstName: 'mary',
			},
		],
	})
})

test('writing a scalar marked with a disabled update overwrites', () => {
	// instantiate the cache
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
							type: 'Int',
							visible: true,
							keyRaw: 'friends',
							updates: [RefetchUpdateMode.append],
						},
					},
				},
			},
		},
	}

	// add some data to the cache
	cache.write({
		selection,
		data: {
			viewer: {
				id: '1',
				firstName: 'bob',
				friends: [1],
			},
		},
	})

	// make sure we can get the linked lists back
	expect(cache.read({ selection }).data).toEqual({
		viewer: {
			id: '1',
			firstName: 'bob',
			friends: [1],
		},
	})

	// add some data to the cache
	cache.write({
		selection,
		data: {
			viewer: {
				id: '1',
				firstName: 'bob',
				friends: [2],
			},
		},
	})

	// make sure we can get the updated lists back
	expect(cache.read({ selection }).data).toEqual({
		viewer: {
			id: '1',
			firstName: 'bob',
			friends: [2],
		},
	})
})

test('writing a scalar marked with a prepend', () => {
	// instantiate the cache
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
							type: 'Int',
							visible: true,
							keyRaw: 'friends',
							updates: [RefetchUpdateMode.prepend],
						},
					},
				},
			},
		},
	}

	// add some data to the cache
	cache.write({
		selection,
		data: {
			viewer: {
				id: '1',
				firstName: 'bob',
				friends: [1],
			},
		},
	})

	// make sure we can get the linked lists back
	expect(cache.read({ selection }).data).toEqual({
		viewer: {
			id: '1',
			firstName: 'bob',
			friends: [1],
		},
	})

	// add some data to the cache
	cache.write({
		selection,
		data: {
			viewer: {
				id: '1',
				firstName: 'bob',
				friends: [2],
			},
		},
		applyUpdates: [RefetchUpdateMode.prepend],
	})

	// make sure we can get the updated lists back
	expect(cache.read({ selection }).data).toEqual({
		viewer: {
			id: '1',
			firstName: 'bob',
			friends: [2, 1],
		},
	})
})

test('writing a scalar marked with an append', () => {
	// instantiate the cache
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
							type: 'Int',
							visible: true,
							keyRaw: 'friends',
							updates: [RefetchUpdateMode.append],
						},
					},
				},
			},
		},
	}

	// add some data to the cache
	cache.write({
		selection,
		data: {
			viewer: {
				id: '1',
				firstName: 'bob',
				friends: [1],
			},
		},
	})

	// make sure we can get the linked lists back
	expect(cache.read({ selection }).data).toEqual({
		viewer: {
			id: '1',
			firstName: 'bob',
			friends: [1],
		},
	})

	// add some data to the cache
	cache.write({
		selection,
		data: {
			viewer: {
				id: '1',
				firstName: 'bob',
				friends: [2],
			},
		},
		applyUpdates: [RefetchUpdateMode.append],
	})

	// make sure we can get the updated lists back
	expect(cache.read({ selection }).data).toEqual({
		viewer: {
			id: '1',
			firstName: 'bob',
			friends: [1, 2],
		},
	})
})

test('list operations fail silently', () => {
	// instantiate a cache
	const cache = new Cache(config)

	// write some data to a different location with a new user
	// that should be added to the list
	expect(() =>
		cache.write({
			selection: {
				fields: {
					newUser: {
						type: 'User',
						visible: true,
						keyRaw: 'newUser',
						operations: [
							{
								action: 'insert',
								list: 'All_Users',
							},
						],
						selection: {
							fields: {
								id: {
									type: 'ID',
									visible: true,
									keyRaw: 'id',
								},
							},
						},
					},
				},
			},
			data: {
				newUser: {
					id: '3',
				},
			},
		})
	).not.toThrow()
})

test('when conditions look for all matching lists', () => {
	// instantiate a cache
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
							// the key takes an argument so that we can have multiple
							// lists tracked in the cache
							keyRaw: 'friends(filter: true, foo: $var)',
							list: {
								name: 'All_Users',
								connection: false,
								type: 'User',
							},
							filters: {
								foo: {
									kind: 'Variable',
									value: 'var',
								},
								filter: {
									kind: 'Boolean',
									value: true,
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
	cache.write({
		selection,
		variables: {
			var: 'hello',
		},
		data: {
			viewer: {
				id: '1',
				friends: [
					{
						id: '2',
						firstName: 'yves',
					},
				],
			},
		},
	})

	// write the same value with a different key
	cache.write({
		selection,
		variables: {
			var: 'world',
		},
		data: {
			viewer: {
				id: '1',
				friends: [
					{
						id: '2',
						firstName: 'yves',
					},
				],
			},
		},
	})

	// a function to spy on that will play the role of set
	const set = vi.fn()

	// subscribe to the fields twice
	cache.subscribe(
		{
			rootType: 'Query',
			onMessage: set,
			selection,
		},
		{
			var: 'world',
		}
	)
	cache.subscribe(
		{
			rootType: 'Query',
			onMessage: set,
			selection,
		},
		{
			var: 'hello',
		}
	)

	// insert an element into the list (no parent ID)
	cache
		.list('All_Users')
		.when({ must: { filter: true } })
		.append({
			selection: {
				fields: {
					id: { visible: true, type: 'ID', keyRaw: 'id' },
					firstName: { visible: true, type: 'String', keyRaw: 'firstName' },
				},
			},
			data: {
				id: '3',
				firstName: 'mathew',
			},
			variables: {
				var: 'hello',
			},
		})

	expect(cache.read({ selection, variables: { var: 'world' } }).data).toEqual({
		viewer: {
			friends: [
				{
					firstName: 'yves',
					id: '2',
				},
				{
					firstName: 'mathew',
					id: '3',
				},
			],
			id: '1',
		},
	})
})

test('parentID must be passed if there are multiple instances of a list handler', () => {
	// instantiate a cache
	const cache = new Cache(config)

	const friendsSelection: SubscriptionSelection = {
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
	}

	// create a list we will add to
	cache.write({
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
							...friendsSelection.fields,
						},
					},
				},
			},
		},
		data: {
			viewer: {
				id: '1',
				friends: [
					{
						id: '2',
						firstName: 'Jean',
					},
				],
			},
		},
	})

	// subscribe to the data to register the list
	cache.subscribe(
		{
			rootType: 'User',
			selection: friendsSelection,
			parentID: cache._internal_unstable.id('User', '1')!,
			onMessage: vi.fn(),
		},
		{}
	)

	// subscribe to the connection with a different parentID
	cache.subscribe(
		{
			rootType: 'User',
			selection: friendsSelection,
			parentID: cache._internal_unstable.id('User', '2')!,
			onMessage: vi.fn(),
		},
		{}
	)

	// append a value to the store
	const writeSelectionNoParentID: SubscriptionSelection = {
		fields: {
			user: {
				type: 'User',
				visible: true,
				keyRaw: 'user',
				operations: [
					{
						action: 'insert',
						list: 'All_Users',
					},
				],
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
	const writeSelectionWithParentID: SubscriptionSelection = {
		fields: {
			user: {
				type: 'User',
				visible: true,
				keyRaw: 'user',
				operations: [
					{
						action: 'insert',
						list: 'All_Users',
						parentID: {
							kind: 'String',
							value: '1',
						},
					},
				],
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

	// write the value without a parent ID
	cache.write({
		selection: writeSelectionNoParentID,
		data: { user: { id: '2', firstName: 'test' } },
	})
	// make sure we didn't modify the lists
	expect([...cache.list('All_Users', '1')]).toHaveLength(1)
	expect([...cache.list('All_Users', '2')]).toHaveLength(0)

	// write the value with a parent ID
	cache.write({
		selection: writeSelectionWithParentID,
		data: { user: { id: '2', firstName: 'test' } },
	})
	// make sure we modified the correct list
	expect([...cache.list('All_Users', '1')]).toHaveLength(2)
	expect([...cache.list('All_Users', '2')]).toHaveLength(0)
})

test('append in abstract list', () => {
	// instantiate a cache
	const cache = new Cache(config)

	const selection: SubscriptionSelection = {
		fields: {
			viewer: {
				type: 'Node',
				visible: true,
				keyRaw: 'viewer',
				selection: {
					fields: {
						id: {
							type: 'ID',
							visible: true,
							keyRaw: 'id',
						},
						__typename: {
							type: 'String',
							visible: true,
							keyRaw: '__typename',
						},
						friends: {
							type: 'Node',
							visible: true,
							keyRaw: 'friends',
							list: {
								name: 'All_Nodes',
								connection: false,
								type: 'Node',
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
									__typename: {
										type: 'String',
										visible: true,
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

	// start off associated with one object
	cache.write({
		selection,
		data: {
			viewer: {
				id: '1',
				__typename: 'User',
				friends: [
					{
						id: '2',
						firstName: 'jane',
						__typename: 'User',
					},
				],
			},
		},
	})

	// a function to spy on that will play the role of set
	const set = vi.fn()

	// subscribe to the fields
	cache.subscribe({
		rootType: 'Query',
		onMessage: set,
		selection,
	})

	// insert an element into the list (no parent ID)
	cache.list('All_Nodes').append({
		selection: {
			fields: {
				id: { visible: true, type: 'ID', keyRaw: 'id' },
				firstName: { visible: true, type: 'String', keyRaw: 'firstName' },
			},
		},
		data: {
			id: '3',
			firstName: 'mary',
			__typename: 'User',
		},
	})

	// make sure we got the new value
	expect(set).toHaveBeenCalledWith({
		kind: 'update',
		data: {
			viewer: {
				id: '1',
				__typename: 'User',
				friends: [
					{
						firstName: 'jane',
						id: '2',
						__typename: 'User',
					},
					{
						firstName: 'mary',
						id: '3',
						__typename: 'User',
					},
				],
			},
		},
	})
})

test('list operations on interface fields without a well defined parent update the correct values in cache', () => {
	// they have to use __typename to compute the parentID because the list type is Node but the cached value is User:OOOOO// instantiate a cache
	const cache = new Cache(config)

	const selection: SubscriptionSelection = {
		fields: {
			viewer: {
				type: 'Node',
				visible: true,
				keyRaw: 'viewer',
				selection: {
					fields: {
						id: {
							type: 'ID',
							visible: true,
							keyRaw: 'id',
						},
						__typename: {
							type: 'String',
							visible: true,
							keyRaw: '__typename',
						},
						friends: {
							type: 'Node',
							visible: true,
							keyRaw: 'friends',
							abstract: true,
							selection: {
								fields: {
									id: {
										type: 'ID',
										visible: true,
										keyRaw: 'id',
									},
									__typename: {
										type: 'String',
										visible: true,
										keyRaw: '__typename',
									},
									notFriends: {
										type: 'Node',
										visible: true,
										keyRaw: 'notFriends',
										abstract: true,
										list: {
											name: 'Not_Friends',
											connection: false,
											type: 'Node',
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
												__typename: {
													type: 'String',
													visible: true,
													keyRaw: '__typename',
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
	cache.write({
		selection,
		data: {
			viewer: {
				id: '1',
				__typename: 'User',
				friends: [
					{
						id: '2',
						__typename: 'User',
						notFriends: [
							{
								id: '3',
								firstName: 'jane',
								__typename: 'User',
							},
						],
					},
					{
						id: '3',
						__typename: 'User',
						notFriends: [
							{
								id: '4',
								firstName: 'jane',
								__typename: 'User',
							},
						],
					},
				],
			},
		},
	})

	// a function to call
	const set = vi.fn()

	// subscribe to the fields (create the list handler)
	cache.subscribe({
		rootType: 'Query',
		onMessage: set,
		selection,
	})

	// insert into the not friends list for user 3
	cache.list('Not_Friends', '3').append({
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
				__typename: {
					type: 'String',
					visible: true,
					keyRaw: '__typename',
				},
			},
		},
		data: {
			id: '5',
			firstName: 'Billy',
			__typename: 'User',
		},
	})

	expect(set).toHaveBeenCalledWith({
		kind: 'update',
		data: {
			viewer: {
				id: '1',
				__typename: 'User',
				friends: [
					{
						id: '2',
						__typename: 'User',
						notFriends: [
							{
								id: '3',
								firstName: 'jane',
								__typename: 'User',
							},
						],
					},
					{
						id: '3',
						__typename: 'User',
						notFriends: [
							{
								id: '4',
								firstName: 'jane',
								__typename: 'User',
							},
							{
								id: '5',
								firstName: 'Billy',
								__typename: 'User',
							},
						],
					},
				],
			},
		},
	})
})

test("parentID ignores single lists that don't match", () => {
	// instantiate a cache
	const cache = new Cache(config)

	// create a list we will add to
	cache.write({
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
						},
					},
				},
			},
		},
		data: {
			viewer: {
				id: '1',
			},
		},
	})

	// subscribe to the data to register the list
	cache.subscribe(
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
			parentID: cache._internal_unstable.id('User', '1')!,
			onMessage: vi.fn(),
		},
		{}
	)

	// write some data to a different location with a new user
	// that should be added to the list
	cache.write({
		selection: {
			fields: {
				newUser: {
					type: 'User',
					visible: true,
					keyRaw: 'newUser',
					operations: [
						{
							action: 'insert',
							list: 'All_Users',
							parentID: {
								kind: 'String',
								value: '2',
							},
						},
					],
					selection: {
						fields: {
							id: {
								type: 'ID',
								visible: true,
								keyRaw: 'id',
							},
						},
					},
				},
			},
		},
		data: {
			newUser: {
				id: '3',
			},
		},
	})

	// make sure we just added to the list
	expect([...cache.list('All_Users', '1')]).toHaveLength(0)
})

test('inserting in list at a specific layer affects just that layer', () => {
	// instantiate a cache
	const cache = new Cache(config)

	// create a list we will add to
	cache.write({
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
						},
					},
				},
			},
		},
		data: {
			viewer: {
				id: '1',
			},
		},
	})

	// subscribe to the data to register the list
	cache.subscribe(
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
			parentID: cache._internal_unstable.id('User', '1')!,
			onMessage: vi.fn(),
		},
		{}
	)

	// write some data before the layer
	cache.write({
		selection: {
			fields: {
				newUser: {
					type: 'User',
					visible: true,
					keyRaw: 'newUser',
					operations: [
						{
							action: 'insert',
							list: 'All_Users',
						},
					],
					selection: {
						fields: {
							id: {
								type: 'ID',
								visible: true,
								keyRaw: 'id',
							},
						},
					},
				},
			},
		},
		data: {
			newUser: {
				id: '2',
			},
		},
	})

	// create a layer that we will write against
	const layer = cache._internal_unstable.storage.createLayer(true)

	// write some data to the specific layer
	cache.write({
		selection: {
			fields: {
				newUser: {
					type: 'User',
					visible: true,
					keyRaw: 'newUser',
					operations: [
						{
							action: 'insert',
							list: 'All_Users',
						},
					],
					selection: {
						fields: {
							id: {
								type: 'ID',
								visible: true,
								keyRaw: 'id',
							},
						},
					},
				},
			},
		},
		layer: layer.id,
		data: {
			newUser: {
				id: '3',
			},
		},
	})

	expect(layer.operations['User:1'].fields.friends).toEqual([
		{
			id: 'User:3',
			kind: 'insert',
			location: 'end',
		},
	])
	expect(layer.links['User:1']).not.toBeDefined()
})

test("two operations referencing the same list don't commit twice", () => {
	// instantiate a cache
	const cache = new Cache(config)

	// create a list we will add to
	cache.write({
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
						},
					},
				},
			},
		},
		data: {
			viewer: {
				id: '1',
			},
		},
	})

	// subscribe to the data to register the list
	cache.subscribe(
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
			parentID: cache._internal_unstable.id('User', '1')!,
			onMessage: vi.fn(),
		},
		{}
	)

	// subscribe to the data to register the list
	cache.subscribe(
		{
			rootType: 'User',
			selection: {
				fields: {
					friends: {
						type: 'User',
						visible: true,
						keyRaw: 'friends',
						list: {
							name: 'Other_Users',
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
			parentID: cache._internal_unstable.id('User', '1')!,
			onMessage: vi.fn(),
		},
		{}
	)

	// write some data with 2 operations
	cache.write({
		selection: {
			fields: {
				newUser: {
					type: 'User',
					visible: true,
					keyRaw: 'newUser',
					operations: [
						{
							action: 'insert',
							list: 'All_Users',
						},
						{
							action: 'insert',
							list: 'Other_Users',
						},
					],
					selection: {
						fields: {
							id: {
								type: 'ID',
								visible: true,
								keyRaw: 'id',
							},
						},
					},
				},
			},
		},
		data: {
			newUser: {
				id: '2',
			},
		},
	})

	const result = cache.read({
		selection: {
			fields: {
				friends: {
					type: 'User',
					visible: true,
					keyRaw: 'friends',
					list: {
						name: 'Other_Users',
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
						},
					},
				},
			},
		},
		parent: cache._internal_unstable.id('User', '1')!,
	})

	expect(result.data).toEqual({
		friends: [
			{
				id: '2',
			},
		],
	})
})

test('@includeListID attaches opaque key to plain list array', () => {
	const cache = new Cache(config)

	cache.write({
		selection: {
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
								selection: {
									fields: {
										id: { type: 'ID', visible: true, keyRaw: 'id' },
									},
								},
							},
						},
					},
				},
			},
		},
		data: { viewer: { id: '1', friends: [{ id: '2' }] } },
	})

	const result = cache.read({
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
						includeListID: true,
					},
					selection: {
						fields: {
							id: { type: 'ID', visible: true, keyRaw: 'id' },
						},
					},
				},
			},
		},
		parent: cache._internal_unstable.id('User', '1')!,
	})

	const parentKey = cache._internal_unstable.id('User', '1')
	expect((result.data?.friends as any).__id).toBe(opaqueListID(parentKey!, 'All_Users'))
})

test('@includeListID attaches opaque key to connection object', () => {
	const cache = new Cache(config)

	cache.write({
		selection: {
			fields: {
				viewer: {
					type: 'User',
					visible: true,
					keyRaw: 'viewer',
					selection: {
						fields: {
							id: { type: 'ID', visible: true, keyRaw: 'id' },
							friendsConnection: {
								type: 'UserConnection',
								visible: true,
								keyRaw: 'friendsConnection',
								selection: {
									fields: {
										edges: {
											type: 'UserEdge',
											visible: true,
											keyRaw: 'edges',
											selection: {
												fields: {
													node: {
														type: 'User',
														visible: true,
														keyRaw: 'node',
														nullable: true,
														selection: {
															fields: {
																id: {
																	type: 'ID',
																	visible: true,
																	keyRaw: 'id',
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
		},
		data: { viewer: { id: '1', friendsConnection: { edges: [{ node: { id: '2' } }] } } },
	})

	const result = cache.read({
		selection: {
			fields: {
				friendsConnection: {
					type: 'UserConnection',
					visible: true,
					keyRaw: 'friendsConnection',
					list: {
						name: 'Friends_Conn',
						connection: true,
						type: 'User',
						includeListID: true,
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
											type: 'User',
											visible: true,
											keyRaw: 'node',
											nullable: true,
											selection: {
												fields: {
													id: { type: 'ID', visible: true, keyRaw: 'id' },
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
		parent: cache._internal_unstable.id('User', '1')!,
	})

	const parentKey = cache._internal_unstable.id('User', '1')
	// the connection object (not an array) gets __id
	expect((result.data?.friendsConnection as any)?.__id).toBe(
		opaqueListID(parentKey!, 'Friends_Conn')
	)
})

test('@includeListID generates distinct keys for two lists on the same parent', () => {
	const cache = new Cache(config)

	cache.write({
		selection: {
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
								selection: {
									fields: { id: { type: 'ID', visible: true, keyRaw: 'id' } },
								},
							},
							followers: {
								type: 'User',
								visible: true,
								keyRaw: 'followers',
								selection: {
									fields: { id: { type: 'ID', visible: true, keyRaw: 'id' } },
								},
							},
						},
					},
				},
			},
		},
		data: { viewer: { id: '1', friends: [{ id: '2' }], followers: [{ id: '3' }] } },
	})

	const result = cache.read({
		selection: {
			fields: {
				friends: {
					type: 'User',
					visible: true,
					keyRaw: 'friends',
					list: {
						name: 'My_Friends',
						connection: false,
						type: 'User',
						includeListID: true,
					},
					selection: { fields: { id: { type: 'ID', visible: true, keyRaw: 'id' } } },
				},
				followers: {
					type: 'User',
					visible: true,
					keyRaw: 'followers',
					list: {
						name: 'My_Followers',
						connection: false,
						type: 'User',
						includeListID: true,
					},
					selection: { fields: { id: { type: 'ID', visible: true, keyRaw: 'id' } } },
				},
			},
		},
		parent: cache._internal_unstable.id('User', '1')!,
	})

	const parentKey = cache._internal_unstable.id('User', '1')
	const friendsListID = (result.data?.friends as any).__id
	const followersListID = (result.data?.followers as any).__id

	// same parent, but different list names → different opaque IDs
	expect(friendsListID).toBe(opaqueListID(parentKey!, 'My_Friends'))
	expect(followersListID).toBe(opaqueListID(parentKey!, 'My_Followers'))
	expect(friendsListID).not.toBe(followersListID)
})

test('@listID operation inserts into the correct list via opaque key', () => {
	const cache = new Cache(config)

	const friendsSelection: SubscriptionSelection = {
		fields: {
			friends: {
				type: 'User',
				visible: true,
				keyRaw: 'friends',
				list: { name: 'All_Users', connection: false, type: 'User', includeListID: true },
				selection: {
					fields: {
						id: { type: 'ID', visible: true, keyRaw: 'id' },
						firstName: { type: 'String', visible: true, keyRaw: 'firstName' },
					},
				},
			},
		},
	}

	cache.write({
		selection: {
			fields: {
				viewer: {
					type: 'User',
					visible: true,
					keyRaw: 'viewer',
					selection: {
						fields: {
							id: { type: 'ID', visible: true, keyRaw: 'id' },
							...friendsSelection.fields,
						},
					},
				},
			},
		},
		data: { viewer: { id: '1', friends: [{ id: '2', firstName: 'Jean' }] } },
	})

	// subscribing registers the list in listsByOpaqueID
	cache.subscribe(
		{
			rootType: 'User',
			selection: friendsSelection,
			parentID: cache._internal_unstable.id('User', '1')!,
			onMessage: vi.fn(),
		},
		{}
	)

	// read to obtain the __id value
	const readResult = cache.read({
		selection: friendsSelection,
		parent: cache._internal_unstable.id('User', '1')!,
	})

	const opaqueID = (readResult.data?.friends as any).__id as string
	expect(opaqueID).toBe(opaqueListID(cache._internal_unstable.id('User', '1')!, 'All_Users'))

	// use the opaque key in a mutation operation
	cache.write({
		selection: {
			fields: {
				newUser: {
					type: 'User',
					visible: true,
					keyRaw: 'newUser',
					operations: [
						{
							action: 'insert',
							list: 'All_Users',
							listID: { kind: 'String', value: opaqueID },
						},
					],
					selection: {
						fields: {
							id: { type: 'ID', visible: true, keyRaw: 'id' },
							firstName: { type: 'String', visible: true, keyRaw: 'firstName' },
						},
					},
				},
			},
		},
		data: { newUser: { id: '3', firstName: 'New User' } },
	})

	expect([...cache.list('All_Users', '1')]).toHaveLength(2)
})

test('writing the same data with connections should not cause additional links to be inserted', function () {
	// instantiate a cache
	const cache = new Cache(config)

	const selection: SubscriptionSelection = {
		fields: {
			user: {
				keyRaw: 'user(id: $id, snapshot: "testing")',
				type: 'User',
				visible: true,
				selection: {
					fields: {
						id: {
							keyRaw: 'id',
							type: 'ID',
							visible: true,
						},
						friendsConnection: {
							keyRaw: 'friendsConnection',
							type: 'UserConnection',
							visible: true,
							selection: {
								fields: {
									edges: {
										keyRaw: 'edges',
										type: 'UserEdge',
										visible: true,
										selection: {
											fields: {
												node: {
													keyRaw: 'node',
													nullable: true,
													type: 'User',
													visible: true,
													selection: {
														fields: {
															id: {
																keyRaw: 'id',
																type: 'ID',
																visible: true,
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
	cache.write({
		selection,
		data: {
			user: {
				friendsConnection: {
					edges: [
						{ node: { id: '1' } },
						{ node: { id: '2' } },
						{ node: { id: '3' } },
						{ node: { id: '4' } },
					],
				},
			},
		},
	})

	const pre = Object.keys(cache._internal_unstable.storage.data[0].links).length

	// We'll write the same selection again. This shouldn't affect the amount of links stored in the cache.
	cache.write({
		selection,
		data: {
			user: {
				friendsConnection: {
					edges: [
						{ node: { id: '1' } },
						{ node: { id: '2' } },
						{ node: { id: '3' } },
						{ node: { id: '4' } },
					],
				},
			},
		},
	})

	const post = Object.keys(cache._internal_unstable.storage.data[0].links).length

	expect(post).toBe(pre)
})

test('shrinking a connection cleans up the orphaned edge records', function () {
	// instantiate a cache
	const cache = new Cache(config)

	const selection: SubscriptionSelection = {
		fields: {
			user: {
				keyRaw: 'user(id: $id, snapshot: "testing")',
				type: 'User',
				visible: true,
				selection: {
					fields: {
						id: {
							keyRaw: 'id',
							type: 'ID',
							visible: true,
						},
						friendsConnection: {
							keyRaw: 'friendsConnection',
							type: 'UserConnection',
							visible: true,
							selection: {
								fields: {
									edges: {
										keyRaw: 'edges',
										type: 'UserEdge',
										visible: true,
										selection: {
											fields: {
												node: {
													keyRaw: 'node',
													nullable: true,
													type: 'User',
													visible: true,
													selection: {
														fields: {
															id: {
																keyRaw: 'id',
																type: 'ID',
																visible: true,
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

	// start off with a connection holding 4 edges
	cache.write({
		selection,
		data: {
			user: {
				friendsConnection: {
					edges: [
						{ node: { id: '1' } },
						{ node: { id: '2' } },
						{ node: { id: '3' } },
						{ node: { id: '4' } },
					],
				},
			},
		},
	})

	const pre = Object.keys(cache._internal_unstable.storage.data[0].links).length

	// write the same connection with only 2 edges. the records for the 2 lost
	// edges should be cleaned up
	cache.write({
		selection,
		data: {
			user: {
				friendsConnection: {
					edges: [{ node: { id: '1' } }, { node: { id: '2' } }],
				},
			},
		},
	})

	const post = Object.keys(cache._internal_unstable.storage.data[0].links).length

	expect(post).toBe(pre - 2)
})

test('upsert list inserts when not present', () => {
	const cache = new Cache(config)

	cache.write({
		selection: {
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
		data: { viewer: { id: '1', friends: [{ id: '5', firstName: 'Alice' }] } },
	})

	cache.subscribe(
		{
			rootType: 'User',
			selection: {
				fields: {
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
			parentID: cache._internal_unstable.id('User', '1')!,
			set: vi.fn(),
		},
		{}
	)

	cache.write({
		selection: {
			fields: {
				newUser: {
					type: 'User',
					visible: true,
					keyRaw: 'newUser',
					operations: [{ action: 'upsert', list: 'All_Users' }],
					selection: {
						fields: {
							id: { type: 'ID', visible: true, keyRaw: 'id' },
							firstName: { type: 'String', visible: true, keyRaw: 'firstName' },
						},
					},
				},
			},
		},
		data: { newUser: { id: '3', firstName: 'Bob' } },
	})

	expect([...cache.list('All_Users', '1')]).toEqual(['User:5', 'User:3'])
})

test('upsert list does not duplicate when already present', () => {
	const cache = new Cache(config)

	cache.write({
		selection: {
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
		data: { viewer: { id: '1', friends: [{ id: '5', firstName: 'Alice' }] } },
	})

	cache.subscribe(
		{
			rootType: 'User',
			selection: {
				fields: {
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
			parentID: cache._internal_unstable.id('User', '1')!,
			set: vi.fn(),
		},
		{}
	)

	const upsertSelection: SubscriptionSelection = {
		fields: {
			newUser: {
				type: 'User',
				visible: true,
				keyRaw: 'newUser',
				operations: [{ action: 'upsert', list: 'All_Users' }],
				selection: {
					fields: {
						id: { type: 'ID', visible: true, keyRaw: 'id' },
						firstName: { type: 'String', visible: true, keyRaw: 'firstName' },
					},
				},
			},
		},
	}

	// upsert User:5 which is already in the list
	cache.write({
		selection: upsertSelection,
		data: { newUser: { id: '5', firstName: 'Alice Updated' } },
	})

	// should still be length 1, no duplicate
	expect([...cache.list('All_Users', '1')]).toEqual(['User:5'])
})

test('upsert list updates record data when already present', () => {
	const cache = new Cache(config)

	const friendsField: SubscriptionSelection = {
		fields: {
			id: { type: 'ID', visible: true, keyRaw: 'id' },
			firstName: { type: 'String', visible: true, keyRaw: 'firstName' },
		},
	}

	cache.write({
		selection: {
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
								selection: friendsField,
							},
						},
					},
				},
			},
		},
		data: { viewer: { id: '1', friends: [{ id: '5', firstName: 'Alice' }] } },
	})

	const set = vi.fn()
	cache.subscribe(
		{
			rootType: 'User',
			selection: {
				fields: {
					friends: {
						type: 'User',
						visible: true,
						keyRaw: 'friends',
						list: { name: 'All_Users', connection: false, type: 'User' },
						selection: friendsField,
					},
				},
			},
			parentID: cache._internal_unstable.id('User', '1')!,
			set,
		},
		{}
	)

	// upsert an existing user with updated data
	cache.write({
		selection: {
			fields: {
				newUser: {
					type: 'User',
					visible: true,
					keyRaw: 'newUser',
					operations: [{ action: 'upsert', list: 'All_Users' }],
					selection: friendsField,
				},
			},
		},
		data: { newUser: { id: '5', firstName: 'Alice Updated' } },
	})

	// list unchanged, but subscriber was called with updated data
	expect([...cache.list('All_Users', '1')]).toEqual(['User:5'])
	expect(set).toHaveBeenCalledWith(
		expect.objectContaining({
			friends: expect.arrayContaining([
				expect.objectContaining({ firstName: 'Alice Updated' }),
			]),
		})
	)
})
