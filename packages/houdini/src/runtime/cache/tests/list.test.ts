import { test, expect, vi } from 'vitest'

import { testConfigFile } from '../../../test'
import { SubscriptionSelection, RefetchUpdateMode } from '../../lib/types'
import { Cache } from '../cache'

const config = testConfigFile()

test('prepend linked lists update', function () {
	// instantiate the cache
	const cache = new Cache(config)

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
						friends: {
							type: 'User',
							keyRaw: 'friends',
							update: RefetchUpdateMode.prepend,
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
		applyUpdates: true,
	})

	// make sure we can get the linked lists back
	expect(
		cache.read({
			selection: {
				fields: {
					friends: {
						type: 'User',
						keyRaw: 'friends',
						update: RefetchUpdateMode.prepend,
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
		applyUpdates: true,
	})

	// make sure we can get the linked lists back
	expect(
		cache.read({
			selection: {
				fields: {
					friends: {
						type: 'User',
						keyRaw: 'friends',
						update: RefetchUpdateMode.prepend,
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

test('append in list', function () {
	// instantiate a cache
	const cache = new Cache(config)

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
		set,
		selection,
	})

	// insert an element into the list (no parent ID)
	cache.list('All_Users').append(
		{
			fields: {
				id: { type: 'ID', keyRaw: 'id' },
				firstName: { type: 'String', keyRaw: 'firstName' },
			},
		},
		{
			id: '3',
			firstName: 'mary',
		}
	)

	// make sure we got the new value
	expect(set).toHaveBeenCalledWith({
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
	})
})

test('prepend in list', function () {
	// instantiate a cache
	const cache = new Cache(config)

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
		set,
		selection,
	})

	// insert an element into the list (no parent ID)
	cache.list('All_Users').prepend(
		{
			fields: {
				id: { type: 'ID', keyRaw: 'id' },
				firstName: { type: 'String', keyRaw: 'firstName' },
			},
		},
		{
			id: '3',
			firstName: 'mary',
		}
	)

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

test('remove from connection', function () {
	// instantiate a cache
	const cache = new Cache(config)

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
		set,
		selection,
	})

	// remove user 2 from the list
	cache.list('All_Users').remove({
		id: '2',
	})

	// the first time set was called, a new entry was added.
	// the second time it's called, we get a new value for mary-prime
	expect(set).toHaveBeenCalledWith({
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
	})

	// make sure we aren't subscribing to user 2 any more
	expect(cache._internal_unstable.subscriptions.get('User:2', 'firstName')).toHaveLength(0)
	// but we're still subscribing to user 3
	expect(cache._internal_unstable.subscriptions.get('User:3', 'firstName')).toHaveLength(1)
})

test('element removed from list can be added back', function () {
	// instantiate a cache
	const cache = new Cache(config)

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
		set,
		selection,
	})

	// remove user 2 from the list
	cache.list('All_Users').remove({
		id: '2',
	})

	cache.list('All_Users').append(
		{
			fields: {
				id: {
					keyRaw: 'id',
					type: 'String',
				},
				firstName: {
					keyRaw: 'firstName',
					type: 'String',
				},
			},
		},
		{
			__typename: 'User',
			id: '2',
			firstName: 'jane2',
		},
		{}
	)

	expect(set).toHaveBeenNthCalledWith(2, {
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
	})
})

test('append in connection', function () {
	// instantiate a cache
	const cache = new Cache(config)

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
		set,
		selection,
	})

	// insert an element into the list (no parent ID)
	cache.list('All_Users').append(
		{
			fields: {
				id: { type: 'ID', keyRaw: 'id' },
				firstName: { type: 'String', keyRaw: 'firstName' },
			},
		},
		{
			id: '3',
			firstName: 'mary',
		}
	)

	// make sure we got the new value
	expect(set).toHaveBeenCalledWith({
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
	})
})

test('inserting data with an update overwrites a record inserted with list.append', function () {
	// instantiate a cache
	const cache = new Cache(config)

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
		set,
		selection,
	})

	// insert an element into the list (no parent ID)
	cache.list('All_Users').append(
		{
			fields: {
				id: { type: 'ID', keyRaw: 'id' },
				firstName: { type: 'String', keyRaw: 'firstName' },
			},
		},
		{
			id: '3',
			firstName: 'mary',
		}
	)

	// insert a record with a query update
	cache.write({
		applyUpdates: true,
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
							friends: {
								type: 'User',
								keyRaw: 'friends',
								selection: {
									fields: {
										edges: {
											type: 'UserEdge',
											keyRaw: 'edges',
											update: RefetchUpdateMode.append,
											selection: {
												fields: {
													cursor: {
														type: 'String',
														keyRaw: 'cursor',
													},
													node: {
														type: 'User',
														keyRaw: 'node',
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
		},
	})

	// make sure the duplicate has been removed
	expect(set).toHaveBeenNthCalledWith(2, {
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
	})
})

test('list filter - must_not positive', function () {
	// instantiate a cache
	const cache = new Cache(config)

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
		set,
		selection,
	})

	// insert an element into the list (no parent ID)
	cache
		.list('All_Users')
		.when({ must_not: { foo: 'not-bar' } })
		.prepend(
			{
				fields: {
					id: { type: 'ID', keyRaw: 'id' },
					firstName: { type: 'String', keyRaw: 'firstName' },
				},
			},
			{
				id: '3',
				firstName: 'mary',
			}
		)

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

test('list filter - must_not negative', function () {
	// instantiate a cache
	const cache = new Cache(config)

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
		set,
		selection,
	})

	// insert an element into the list (no parent ID)
	cache
		.list('All_Users')
		.when({ must_not: { foo: 'bar' } })
		.prepend(
			{
				fields: {
					id: { type: 'ID', keyRaw: 'id' },
					firstName: { type: 'String', keyRaw: 'firstName' },
				},
			},
			{
				id: '3',
				firstName: 'mary',
			}
		)

	// make sure we got the new value
	expect(set).not.toHaveBeenCalled()
})

test('list filter - must positive', function () {
	// instantiate a cache
	const cache = new Cache(config)

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
		set,
		selection,
	})

	// insert an element into the list (no parent ID)
	cache
		.list('All_Users')
		.when({ must: { foo: 'bar' } })
		.prepend(
			{
				fields: {
					id: { type: 'ID', keyRaw: 'id' },
					firstName: { type: 'String', keyRaw: 'firstName' },
				},
			},
			{
				id: '3',
				firstName: 'mary',
			}
		)

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

test('list filter - must negative', function () {
	// instantiate a cache
	const cache = new Cache(config)

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
		set,
		selection,
	})

	// insert an element into the list (no parent ID)
	cache
		.list('All_Users')
		.when({ must: { foo: 'not-bar' } })
		.prepend(
			{
				fields: {
					id: { type: 'ID', keyRaw: 'id' },
					firstName: { type: 'String', keyRaw: 'firstName' },
				},
			},
			{
				id: '3',
				firstName: 'mary',
			}
		)

	// make sure we got the new value
	expect(set).not.toHaveBeenCalled()
})

test('remove from list', function () {
	// instantiate a cache
	const cache = new Cache(config)

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
		set,
		selection,
	})

	// remove user 2 from the list
	cache.list('All_Users').remove({
		id: '2',
	})

	// the first time set was called, a new entry was added.
	// the second time it's called, we get a new value for mary-prime
	expect(set).toHaveBeenCalledWith({
		viewer: {
			id: '1',
			friends: [],
		},
	})

	// make sure we aren't subscribing to user 2 any more
	expect(cache._internal_unstable.subscriptions.get('User:2', 'firstName')).toHaveLength(0)
})

test('delete node', function () {
	// instantiate a cache
	const cache = new Cache(config)

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
		set,
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
		viewer: {
			id: '1',
			friends: [],
		},
	})

	// make sure its empty now
	expect(cache._internal_unstable.storage.topLayer.operations['User:2'].deleted).toBeTruthy()
})

test('delete node from connection', function () {
	// instantiate a cache
	const cache = new Cache(config)

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
		set,
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
		viewer: {
			id: '1',
			friends: {
				edges: [],
			},
		},
	})

	// make sure its empty now
	expect(cache._internal_unstable.storage.topLayer.operations['User:2'].deleted).toBeTruthy()
})

test('append operation', function () {
	// instantiate a cache
	const cache = new Cache(config)

	// create a list we will add to
	cache.write({
		selection: {
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
			parentID: cache._internal_unstable.id('User', '1')!,
			set: vi.fn(),
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

test('append from list', function () {
	// instantiate a cache
	const cache = new Cache(config)

	// create a list we will add to
	cache.write({
		selection: {
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
			parentID: cache._internal_unstable.id('User', '1')!,
			set: vi.fn(),
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

test('toggle list', function () {
	// instantiate a cache
	const cache = new Cache(config)

	// create a list we will add to
	cache.write({
		selection: {
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
			parentID: cache._internal_unstable.id('User', '1')!,
			set: vi.fn(),
		},
		{}
	)

	const toggleSelection: SubscriptionSelection = {
		fields: {
			newUser: {
				type: 'User',
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

test('append when operation', function () {
	// instantiate a cache
	const cache = new Cache(config)

	// create a list we will add to
	cache.write({
		selection: {
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
			parentID: cache._internal_unstable.id('User', '1')!,
			set: vi.fn(),
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
					keyRaw: 'newUser',
					operations: [
						{
							action: 'insert',
							list: 'All_Users',
							when: {
								must: {
									value: 'not-foo',
								},
							},
						},
					],
					selection: {
						fields: {
							id: {
								type: 'ID',
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

test('prepend when operation', function () {
	// instantiate a cache
	const cache = new Cache(config)

	// create a list we will add to
	cache.write({
		selection: {
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
			parentID: cache._internal_unstable.id('User', '1')!,
			set: vi.fn(),
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
					keyRaw: 'newUser',
					operations: [
						{
							action: 'insert',
							list: 'All_Users',
							position: 'first',
							when: {
								must: {
									value: 'not-foo',
								},
							},
						},
					],
					selection: {
						fields: {
							id: {
								type: 'ID',
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

test('prepend operation', function () {
	// instantiate a cache
	const cache = new Cache(config)

	// create a list we will add to
	cache.write({
		selection: {
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
								selection: {
									fields: {
										id: {
											type: 'String',
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
			parentID: cache._internal_unstable.id('User', '1')!,
			set: vi.fn(),
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

test('remove operation', function () {
	// instantiate a cache
	const cache = new Cache(config)

	// create a list we will add to
	cache.write({
		selection: {
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
			parentID: cache._internal_unstable.id('User', '1')!,
			set: vi.fn(),
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

test('remove operation from list', function () {
	// instantiate a cache
	const cache = new Cache(config)

	// create a list we will add to
	cache.write({
		selection: {
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
			parentID: cache._internal_unstable.id('User', '1')!,
			set: vi.fn(),
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

test('delete operation', function () {
	// instantiate a cache
	const cache = new Cache(config)

	// create a list we will add to
	cache.write({
		selection: {
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
			parentID: cache._internal_unstable.id('User', '1')!,
			set: vi.fn(),
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
					keyRaw: 'deleteUser',
					selection: {
						fields: {
							id: {
								type: 'ID',
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

test('delete operation from list', function () {
	// instantiate a cache
	const cache = new Cache(config)

	// create a list we will add to
	cache.write({
		selection: {
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
			parentID: cache._internal_unstable.id('User', '1')!,
			set: vi.fn(),
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
					keyRaw: 'deleteUser',
					selection: {
						fields: {
							id: {
								type: 'ID',
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

test('delete operation from connection', function () {
	// instantiate a cache
	const cache = new Cache(config)

	// create a list we will add to
	cache.write({
		selection: {
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
			parentID: cache._internal_unstable.id('User', '1')!,
			set: vi.fn(),
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
					keyRaw: 'deleteUser',
					selection: {
						fields: {
							id: {
								type: 'ID',
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

test('disabled linked lists update', function () {
	// instantiate the cache
	const cache = new Cache(config)

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
						friends: {
							type: 'User',
							keyRaw: 'friends',
							update: RefetchUpdateMode.append,
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

test('append linked lists update', function () {
	// instantiate the cache
	const cache = new Cache(config)

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
						friends: {
							type: 'User',
							keyRaw: 'friends',
							update: RefetchUpdateMode.append,
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
		applyUpdates: true,
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

test('writing a scalar marked with a disabled update overwrites', function () {
	// instantiate the cache
	const cache = new Cache(config)

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
						friends: {
							type: 'Int',
							keyRaw: 'friends',
							update: RefetchUpdateMode.append,
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

test('writing a scalar marked with a prepend', function () {
	// instantiate the cache
	const cache = new Cache(config)

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
						friends: {
							type: 'Int',
							keyRaw: 'friends',
							update: RefetchUpdateMode.prepend,
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
		applyUpdates: true,
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

test('writing a scalar marked with an append', function () {
	// instantiate the cache
	const cache = new Cache(config)

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
						friends: {
							type: 'Int',
							keyRaw: 'friends',
							update: RefetchUpdateMode.append,
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
		applyUpdates: true,
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

test('list operations fail silently', function () {
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

test('when conditions look for all matching lists', function () {
	// instantiate a cache
	const cache = new Cache(config)

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
			set,
			selection,
		},
		{
			var: 'world',
		}
	)
	cache.subscribe(
		{
			rootType: 'Query',
			set,
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
		.append(
			{
				fields: {
					id: { type: 'ID', keyRaw: 'id' },
					firstName: { type: 'String', keyRaw: 'firstName' },
				},
			},
			{
				id: '3',
				firstName: 'mathew',
			},
			{
				var: 'hello',
			}
		)

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

test('parentID must be passed if there are multiple instances of a list handler', function () {
	// instantiate a cache
	const cache = new Cache(config)

	const friendsSelection: SubscriptionSelection = {
		fields: {
			friends: {
				type: 'User',
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
	}

	// create a list we will add to
	cache.write({
		selection: {
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
			set: vi.fn(),
		},
		{}
	)

	// subscribe to the connection with a different parentID
	cache.subscribe(
		{
			rootType: 'User',
			selection: friendsSelection,
			parentID: cache._internal_unstable.id('User', '2')!,
			set: vi.fn(),
		},
		{}
	)

	// append a value to the store
	const writeSelectionNoParentID: SubscriptionSelection = {
		fields: {
			user: {
				type: 'User',
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
	}
	const writeSelectionWithParentID: SubscriptionSelection = {
		fields: {
			user: {
				type: 'User',
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

test('append in abstract list', function () {
	// instantiate a cache
	const cache = new Cache(config)

	const selection: SubscriptionSelection = {
		fields: {
			viewer: {
				type: 'Node',
				keyRaw: 'viewer',
				selection: {
					fields: {
						id: {
							type: 'ID',
							keyRaw: 'id',
						},
						__typename: {
							type: 'String',
							keyRaw: '__typename',
						},
						friends: {
							type: 'Node',
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
		set,
		selection,
	})

	// insert an element into the list (no parent ID)
	cache.list('All_Nodes').append(
		{
			fields: {
				id: { type: 'ID', keyRaw: 'id' },
				firstName: { type: 'String', keyRaw: 'firstName' },
			},
		},
		{
			id: '3',
			firstName: 'mary',
			__typename: 'User',
		}
	)

	// make sure we got the new value
	expect(set).toHaveBeenCalledWith({
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
	})
})

test('list operations on interface fields without a well defined parent update the correct values in cache', function () {
	// they have to use __typename to compute the parentID because the list type is Node but the cached value is User:OOOOO// instantiate a cache
	const cache = new Cache(config)

	const selection: SubscriptionSelection = {
		fields: {
			viewer: {
				type: 'Node',
				keyRaw: 'viewer',
				selection: {
					fields: {
						id: {
							type: 'ID',
							keyRaw: 'id',
						},
						__typename: {
							type: 'String',
							keyRaw: '__typename',
						},
						friends: {
							type: 'Node',
							keyRaw: 'friends',
							abstract: true,
							selection: {
								fields: {
									id: {
										type: 'ID',
										keyRaw: 'id',
									},
									__typename: {
										type: 'String',
										keyRaw: '__typename',
									},
									notFriends: {
										type: 'Node',
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
		set,
		selection,
	})

	// insert into the not friends list for user 3
	cache.list('Not_Friends', '3').append(
		{
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
		{
			id: '5',
			firstName: 'Billy',
			__typename: 'User',
		}
	)

	expect(set).toHaveBeenCalledWith({
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
	})
})

test("parentID ignores single lists that don't match", function () {
	// instantiate a cache
	const cache = new Cache(config)

	// create a list we will add to
	cache.write({
		selection: {
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
			parentID: cache._internal_unstable.id('User', '1')!,
			set: vi.fn(),
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
