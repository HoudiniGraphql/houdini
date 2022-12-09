import { test, expect, vi } from 'vitest'

import { testConfigFile } from '../../../test'
import { RefetchUpdateMode, SubscriptionSelection } from '../../lib'
import { Cache } from '../cache'

const config = testConfigFile()

test('root subscribe - field change', function () {
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
						firstName: {
							type: 'String',
							keyRaw: 'firstName',
						},
						favoriteColors: {
							type: 'String',
							keyRaw: 'favoriteColors',
						},
					},
				},
			},
		},
	}

	// write some data
	cache.write({
		selection,
		data: {
			viewer: {
				id: '1',
				firstName: 'bob',
				favoriteColors: ['red', 'green', 'blue'],
			},
		},
	})

	// a function to spy on that will play the role of set
	const set = vi.fn()

	// subscribe to the fields
	cache.subscribe({
		rootType: 'Query',
		selection,
		set,
	})

	// somehow write a user to the cache with the same id, but a different name
	cache.write({
		selection,
		data: {
			viewer: {
				id: '1',
				firstName: 'mary',
			},
		},
	})

	// make sure that set got called with the full response
	expect(set).toHaveBeenCalledWith({
		viewer: {
			firstName: 'mary',
			favoriteColors: ['red', 'green', 'blue'],
			id: '1',
		},
	})
})

test('root subscribe - linked object changed', function () {
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
						firstName: {
							type: 'String',
							keyRaw: 'firstName',
						},
						favoriteColors: {
							type: 'String',
							keyRaw: 'favoriteColors(where: "foo")',
							nullable: true,
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
				firstName: 'bob',
				favoriteColors: ['red', 'green', 'blue'],
			},
		},
	})

	// a function to spy on that will play the role of set
	const set = vi.fn()

	// subscribe to the fields
	cache.subscribe({
		rootType: 'Query',
		selection,
		set,
	})

	// somehow write a user to the cache with a different id
	cache.write({
		selection,
		data: {
			viewer: {
				id: '2',
				firstName: 'mary',
			},
		},
	})

	// make sure that set got called with the full response
	expect(set).toHaveBeenCalledWith({
		viewer: {
			firstName: 'mary',
			// this is a sanity-check. the cache wasn't written with that value
			favoriteColors: null,
			id: '2',
		},
	})

	// write a value to the new record
	cache.write({
		selection: {
			fields: {
				firstName: {
					type: 'String',
					keyRaw: 'firstName',
				},
			},
		},
		data: {
			firstName: 'Michelle',
		},
		parent: 'User:2',
	})

	expect(set).toHaveBeenCalledTimes(2)

	// make sure that set got called with the full response
	expect(set).toHaveBeenLastCalledWith({
		viewer: {
			firstName: 'Michelle',
			id: '2',
			favoriteColors: null,
		},
	})

	// make sure we are no longer subscribing to user 1
	expect(cache._internal_unstable.subscriptions.get('User:1', 'firstName')).toHaveLength(0)
})

test("subscribing to null object doesn't explode", function () {
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
						firstName: {
							type: 'String',
							keyRaw: 'firstName',
						},
						favoriteColors: {
							nullable: true,
							type: 'String',
							keyRaw: 'favoriteColors(where: "foo")',
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
			viewer: null,
		},
	})

	// a function to spy on that will play the role of set
	const set = vi.fn()

	// subscribe to the fields
	cache.subscribe({
		rootType: 'Query',
		selection,
		set,
	})

	// somehow write a user to the cache with a different id
	cache.write({
		selection,
		data: {
			viewer: {
				id: '2',
				firstName: 'mary',
			},
		},
	})

	// make sure that set got called with the full response
	expect(set).toHaveBeenCalledWith({
		viewer: {
			firstName: 'mary',
			favoriteColors: null,
			id: '2',
		},
	})
})

test('overwriting a reference with null clears its subscribers', function () {
	// instantiate a cache
	const cache = new Cache(config)

	const selection: SubscriptionSelection = {
		fields: {
			viewer: {
				type: 'User',
				keyRaw: 'viewer',
				nullable: true,
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
						favoriteColors: {
							type: 'String',
							keyRaw: 'favoriteColors(where: "foo")',
						},
					},
				},
			},
		},
	}

	// somehow write a user to the cache with a different id
	cache.write({
		selection,
		data: {
			viewer: {
				id: '2',
				firstName: 'mary',
			},
		},
	})

	// a function to spy on that will play the role of set
	const set = vi.fn()

	// subscribe to the fields
	cache.subscribe({
		rootType: 'Query',
		selection,
		set,
	})

	// start off associated with one object
	cache.write({
		selection,
		data: {
			viewer: null,
		},
	})

	// make sure that set got called with the full response
	expect(set).toHaveBeenCalledWith({
		viewer: null,
	})

	// we shouldn't be subscribing to user 3 any more
	expect(cache._internal_unstable.subscriptions.get('User:2', 'firstName')).toHaveLength(0)
})

test('overwriting a linked list with null clears its subscribers', function () {
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
							nullable: true,
							selection: {
								fields: {
									firstName: {
										type: 'String',
										keyRaw: 'firstName',
									},
									id: {
										type: 'ID',
										keyRaw: 'id',
									},
								},
							},
						},
					},
				},
			},
		},
	}

	// a function to spy on that will play the role of set
	const set = vi.fn()

	// subscribe to the fields
	cache.subscribe({
		rootType: 'Query',
		selection,
		set,
	})

	// add some users that we will subscribe to
	cache.write({
		selection,
		data: {
			viewer: {
				id: '1',
				friends: [
					{ id: '2', firstName: 'Jason' },
					{ id: '3', firstName: 'Nick' },
				],
			},
		},
	})

	// make sure something is subscribing to the friends field
	expect(cache._internal_unstable.subscriptions.get('User:1', 'friends')).toHaveLength(1)
	expect(cache._internal_unstable.subscriptions.get('User:2', 'firstName')).toHaveLength(1)
	expect(cache._internal_unstable.subscriptions.get('User:3', 'firstName')).toHaveLength(1)

	// write null over the list
	cache.write({
		selection: {
			fields: {
				id: {
					type: 'String',
					keyRaw: 'id',
				},
				friends: selection.fields!.viewer.selection!.fields!.friends,
			},
		},
		data: {
			id: '1',
			friends: null,
		},
		parent: 'User:1',
	})

	// make sure that set got called with the full response
	expect(set).toHaveBeenNthCalledWith(2, {
		viewer: {
			id: '1',
			friends: null,
		},
	})

	// we shouldn't be subscribing to user 3 any more
	expect(cache._internal_unstable.subscriptions.get('User:2', 'firstName')).toHaveLength(0)
	expect(cache._internal_unstable.subscriptions.get('User:3', 'firstName')).toHaveLength(0)
})

test('root subscribe - linked list lost entry', function () {
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

	// start off associated with two objects
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
						firstName: 'mary',
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
		selection,
		set,
	})

	// somehow write a user to the cache with a new friends list
	cache.write({
		selection,
		data: {
			viewer: {
				id: '1',
				friends: [
					{
						id: '2',
					},
				],
			},
		},
	})

	// make sure that set got called with the full response
	expect(set).toHaveBeenCalledWith({
		viewer: {
			id: '1',
			friends: [
				{
					firstName: 'jane',
					id: '2',
				},
			],
		},
	})

	// we shouldn't be subscribing to user 3 any more
	expect(cache._internal_unstable.subscriptions.get('User:3', 'firstName')).toHaveLength(0)
})

test("subscribing to list with null values doesn't explode", function () {
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
					null,
				],
			},
		},
	})

	// a function to spy on that will play the role of set
	const set = vi.fn()

	// subscribe to the fields
	cache.subscribe({
		rootType: 'Query',
		selection,
		set,
	})

	// somehow write a user to the cache with a new friends list
	cache.write({
		selection,
		data: {
			viewer: {
				id: '1',
				friends: [
					{
						id: '2',
					},
				],
			},
		},
	})

	// make sure that set got called with the full response
	expect(set).toHaveBeenCalledWith({
		viewer: {
			id: '1',
			friends: [
				{
					firstName: 'jane',
					id: '2',
				},
			],
		},
	})
})

test('root subscribe - linked list reorder', function () {
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
					{
						id: '3',
						firstName: 'mary',
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

	// somehow write a user to the cache with the same id, but a different name
	cache.write({
		selection,
		data: {
			viewer: {
				id: '1',
				friends: [
					{
						id: '3',
					},
					{
						id: '2',
					},
				],
			},
		},
	})

	// make sure that set got called with the full response
	expect(set).toHaveBeenCalledWith({
		viewer: {
			id: '1',
			friends: [
				{
					id: '3',
					firstName: 'mary',
				},
				{
					id: '2',
					firstName: 'jane',
				},
			],
		},
	})

	// we should still be subscribing to both users
	expect(cache._internal_unstable.subscriptions.get('User:2', 'firstName')).toHaveLength(1)
	expect(cache._internal_unstable.subscriptions.get('User:3', 'firstName')).toHaveLength(1)
})

test('unsubscribe', function () {
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
						firstName: {
							type: 'String',
							keyRaw: 'firstName',
						},
						favoriteColors: {
							type: 'String',
							keyRaw: 'favoriteColors(where: "foo")',
						},
					},
				},
			},
		},
	}

	// write some data
	cache.write({
		selection,
		data: {
			viewer: {
				id: '1',
				firstName: 'bob',
				favoriteColors: ['red', 'green', 'blue'],
			},
		},
	})

	// the spec we will register/unregister
	const spec = {
		rootType: 'Query',
		selection,
		set: vi.fn(),
	}

	// subscribe to the fields
	cache.subscribe(spec)

	// make sure we  registered the subscriber
	expect(cache._internal_unstable.subscriptions.get('User:1', 'firstName')).toHaveLength(1)

	// unsubscribe
	cache.unsubscribe(spec)

	// make sure there is no more subscriber
	expect(cache._internal_unstable.subscriptions.get('User:1', 'firstName')).toHaveLength(0)
})

test('subscribe to new list nodes', function () {
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

	// a function to spy on that will play the role of set
	const set = vi.fn()

	// subscribe to the fields
	cache.subscribe({
		rootType: 'Query',
		set,
		selection,
	})

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

	// update the user we just added
	cache.write({
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
		data: {
			id: '2',
			firstName: 'jane-prime',
		},
		parent: 'User:2',
	})

	// the first time set was called, a new entry was added.
	// the second time it's called, we get a new value for jane
	expect(set).toHaveBeenNthCalledWith(2, {
		viewer: {
			id: '1',
			friends: [
				{
					firstName: 'jane-prime',
					id: '2',
				},
			],
		},
	})

	// add a new user
	cache.write({
		selection,
		data: {
			viewer: {
				id: '1',
				friends: [
					{
						id: '2',
						firstName: 'jane-prime',
					},
					{
						id: '3',
						firstName: 'mary',
					},
				],
			},
		},
	})

	// update the user we just added
	cache.write({
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
		data: {
			id: '3',
			firstName: 'mary-prime',
		},
		parent: 'User:3',
	})

	// the third time set was called, a new entry was added.
	// the fourth time it's called, we get a new value for mary
	expect(set).toHaveBeenNthCalledWith(4, {
		viewer: {
			id: '1',
			friends: [
				{
					firstName: 'jane-prime',
					id: '2',
				},
				{
					firstName: 'mary-prime',
					id: '3',
				},
			],
		},
	})
})

test('variables in query and subscription', function () {
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
							keyRaw: 'friends(filter: $filter)',
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
					{
						id: '3',
						firstName: 'mary',
					},
				],
			},
		},
		variables: {
			filter: 'foo',
		},
	})

	// a function to spy on that will play the role of set
	const set = vi.fn()

	// subscribe to the fields
	cache.subscribe(
		{
			rootType: 'Query',
			selection,
			set,
			variables: () => ({ filter: 'foo' }),
		},
		{
			filter: 'foo',
		}
	)

	// make sure we have a cached value for friends(filter: "foo")
	expect(cache.list('All_Users').lists[0].key).toEqual('friends(filter: "foo")')

	// somehow write a user to the cache with a new friends list
	cache.write({
		selection,
		data: {
			viewer: {
				id: '1',
				friends: [
					{
						id: '2',
					},
				],
			},
		},
		variables: {
			filter: 'foo',
		},
	})

	// make sure that set got called with the full response
	expect(set).toHaveBeenCalledWith({
		viewer: {
			id: '1',
			friends: [
				{
					firstName: 'jane',
					id: '2',
				},
			],
		},
	})

	// we shouldn't be subscribing to user 3 any more
	expect(cache._internal_unstable.subscriptions.get('User:3', 'firstName')).toHaveLength(0)
})

test('deleting a node removes nested subscriptions', function () {
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
		selection,
		set,
	})

	// sanity check
	expect(cache._internal_unstable.subscriptions.get('User:2', 'firstName')).toHaveLength(1)

	// delete the parent
	cache.delete('User:1')

	// sanity check
	expect(cache._internal_unstable.subscriptions.get('User:2', 'firstName')).toHaveLength(0)
})

test('same record twice in a query survives one unsubscribe (reference counting)', function () {
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
						firstName: {
							type: 'String',
							keyRaw: 'firstName',
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
				firstName: 'bob',
				friends: [
					{
						id: '1',
						firstName: 'bob',
					},
				],
			},
		},
		variables: {
			filter: 'foo',
		},
	})

	// a function to spy on that will play the role of set
	const set = vi.fn()

	// subscribe to the fields
	cache.subscribe(
		{
			rootType: 'Query',
			selection,
			set,
		},
		{
			filter: 'foo',
		}
	)

	// make sure there is a subscriber for the user's first name
	expect(cache._internal_unstable.subscriptions.get('User:1', 'firstName')).toHaveLength(1)

	// remove the user from the list
	cache.list('All_Users').remove({ id: '1' })

	// we should still be subscribing to the user's first name
	expect(cache._internal_unstable.subscriptions.get('User:1', 'firstName')).toHaveLength(1)
})

test('embedded references', function () {
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
							selection: {
								fields: {
									edges: {
										type: 'UserEdge',
										keyRaw: 'edges',
										selection: {
											fields: {
												node: {
													type: 'User',
													keyRaw: 'node',
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
						},
					},
				},
			},
		},
	}

	// write an embedded list of embedded objects holding references to an object
	cache.write({
		selection,
		data: {
			viewer: {
				id: '1',
				friends: {
					edges: [
						{
							node: {
								id: '2',
								firstName: 'jane',
							},
						},
						{
							node: {
								id: '3',
								firstName: 'mary',
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
	cache.subscribe(
		{
			rootType: 'Query',
			selection,
			set,
		},
		{
			filter: 'foo',
		}
	)

	// update one of the embedded references
	cache.write({
		selection: {
			fields: {
				user: {
					type: 'User',
					keyRaw: 'user',
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
		data: {
			user: {
				id: '2',
				firstName: 'not-jane',
			},
		},
	})

	// make sure we got the updated data
	expect(set).toHaveBeenCalledWith({
		viewer: {
			id: '1',
			friends: {
				edges: [
					{
						node: {
							id: '2',
							firstName: 'not-jane',
						},
					},
					{
						node: {
							id: '3',
							firstName: 'mary',
						},
					},
				],
			},
		},
	})
})

test('self-referencing linked lists can be unsubscribed (avoid infinite recursion)', function () {
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
						id: '1',
						firstName: 'bob',
						friends: [
							{
								id: '1',
								firstName: 'bob',
							},
						],
					},
				],
			},
		},
	})

	// subscribe to the list
	const spec = {
		set: vi.fn(),
		selection,
		rootType: 'Query',
	}
	cache.subscribe(spec)
	cache.unsubscribe(spec)

	// no one should be subscribing to User:1's first name
	expect(cache._internal_unstable.subscriptions.get('User:1', 'firstName')).toHaveLength(0)
})

test('self-referencing links can be unsubscribed (avoid infinite recursion)', function () {
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
						friend: {
							type: 'User',
							keyRaw: 'friend',
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
									friend: {
										type: 'User',
										keyRaw: 'friend',
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
												friend: {
													type: 'User',
													keyRaw: 'friend',
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
				friend: {
					id: '1',
					firstName: 'bob',
					friend: {
						id: '1',
						firstName: 'bob',
						friend: {
							id: '1',
							firstName: 'bob',
						},
					},
				},
			},
		},
	})

	// subscribe to the list
	const spec = {
		set: vi.fn(),
		selection,
		rootType: 'Query',
	}
	cache.subscribe(spec)
	cache.unsubscribe(spec)

	// no one should be subscribing to User:1's first name
	expect(cache._internal_unstable.subscriptions.get('User:1', 'firstName')).toHaveLength(0)
})

test('overwriting a value in an optimistic layer triggers subscribers', function () {
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
						firstName: {
							type: 'String',
							keyRaw: 'firstName',
						},
						favoriteColors: {
							type: 'String',
							keyRaw: 'favoriteColors',
						},
					},
				},
			},
		},
	}

	// write some data
	cache.write({
		selection,
		data: {
			viewer: {
				id: '1',
				firstName: 'bob',
				favoriteColors: ['red', 'green', 'blue'],
			},
		},
	})

	// a function to spy on that will play the role of set
	const set = vi.fn()

	// subscribe to the fields
	cache.subscribe({
		rootType: 'Query',
		selection,
		set,
	})

	// create an optimistic layer on top
	const layer = cache._internal_unstable.storage.createLayer(true)

	// somehow write a user to the cache with the same id, but a different name
	cache.write({
		selection,
		data: {
			viewer: {
				id: '1',
				firstName: 'mary',
			},
		},
		layer: layer.id,
	})

	// make sure that set got called with the full response
	expect(set).toHaveBeenCalledWith({
		viewer: {
			firstName: 'mary',
			favoriteColors: ['red', 'green', 'blue'],
			id: '1',
		},
	})
})

test('clearing a display layer updates subscribers', function () {
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
						firstName: {
							type: 'String',
							keyRaw: 'firstName',
						},
						favoriteColors: {
							type: 'String',
							keyRaw: 'favoriteColors',
						},
					},
				},
			},
		},
	}

	// write some data
	cache.write({
		selection,
		data: {
			viewer: {
				id: '1',
				firstName: 'bob',
				favoriteColors: ['red', 'green', 'blue'],
			},
		},
	})

	// a function to spy on that will play the role of set
	const set = vi.fn()

	// subscribe to the fields
	cache.subscribe({
		rootType: 'Query',
		selection,
		set,
	})

	// create an optimistic layer on top
	const layer = cache._internal_unstable.storage.createLayer(true)

	// somehow write a user to the cache with the same id, but a different name
	cache.write({
		selection,
		data: {
			viewer: {
				id: '1',
				firstName: 'mary',
			},
		},
		layer: layer.id,
	})

	// make sure that set got called with the full response
	expect(set).toHaveBeenCalledWith({
		viewer: {
			firstName: 'mary',
			favoriteColors: ['red', 'green', 'blue'],
			id: '1',
		},
	})

	// clear the layer
	layer.clear()

	// write the with the same values to the layer that were previously in place
	cache.write({
		selection,
		data: {
			viewer: {
				firstName: 'mary',
				favoriteColors: ['red', 'green', 'blue'],
				id: '1',
			},
		},
		layer: layer.id,
	})

	expect(set).toHaveBeenNthCalledWith(2, {
		viewer: {
			firstName: 'mary',
			favoriteColors: ['red', 'green', 'blue'],
			id: '1',
		},
	})
})

test('ensure parent type is properly passed for nested lists', function () {
	// instantiate a cache
	const cache = new Cache(config)

	const selection: SubscriptionSelection = {
		fields: {
			cities: {
				type: 'City',
				keyRaw: 'cities',
				list: {
					name: 'City_List',
					connection: false,
					type: 'City',
				},
				update: RefetchUpdateMode.append,
				selection: {
					fields: {
						id: {
							type: 'ID',
							keyRaw: 'id',
						},
						name: {
							type: 'String',
							keyRaw: 'name',
						},
						libraries: {
							type: 'Library',
							keyRaw: 'libraries',
							update: RefetchUpdateMode.append,
							list: {
								name: 'Library_List',
								connection: false,
								type: 'Library',
							},
							selection: {
								fields: {
									id: {
										type: 'ID',
										keyRaw: 'id',
									},
									name: {
										type: 'String',
										keyRaw: 'name',
									},
									books: {
										type: 'Book',
										keyRaw: 'books',
										list: {
											name: 'Book_List',
											connection: false,
											type: 'Book',
										},
										selection: {
											fields: {
												id: {
													type: 'ID',
													keyRaw: 'id',
												},
												title: {
													type: 'String',
													keyRaw: 'title',
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

	// a function to spy on that will play the role of set
	const set = vi.fn()

	// subscribe to the fields
	cache.subscribe({
		rootType: 'Query',
		selection,
		set,
	})

	// add a city to the list by hand since using the list util adds type information

	cache.write({
		selection,
		data: {
			cities: [
				{
					id: '1',
					name: 'Alexandria',
					libraries: [
						{
							id: '1',
							name: 'The Library of Alexandria',
							books: [],
						},
						{
							id: '2',
							name: 'Bibliotheca Alexandrina',
							books: [],
						},
					],
				},
				{
					id: '2',
					name: 'Aalborg',
					libraries: [],
				},
			],
		},
	})

	// since there are multiple lists inside of City_List, we need to
	// specify the parentID of the city in order to add a library to City:3
	expect(() => cache.list('Library_List', '2')).not.toThrow()
	// same with Books_List for Library:2
	expect(() => cache.list('Book_List', '2')).not.toThrow()
})

test('subscribe to abstract fields of matching type', function () {
	// instantiate a cache
	const cache = new Cache(config)

	const selection: SubscriptionSelection = {
		fields: {
			viewer: {
				type: 'Node',
				keyRaw: 'viewer',
				abstract: true,
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
					abstractFields: {
						typeMap: {},
						fields: {
							User: {
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
								favoriteColors: {
									type: 'String',
									keyRaw: 'favoriteColors',
								},
							},
						},
					},
				},
			},
		},
	}

	// write some data
	cache.write({
		selection,
		data: {
			viewer: {
				__typename: 'User',
				id: '1',
				firstName: 'bob',
				favoriteColors: [],
			},
		},
	})

	// a function to spy on that will play the role of set
	const set = vi.fn()

	// subscribe to the fields
	cache.subscribe({
		rootType: 'Query',
		selection,
		set,
	})

	// somehow write a user to the cache with the same id, but a different name
	cache.write({
		selection,
		data: {
			viewer: {
				__typename: 'User',
				id: '1',
				favoriteColors: ['red', 'green', 'blue'],
			},
		},
	})

	// make sure that set got called with the full response
	expect(set).toHaveBeenCalledWith({
		viewer: {
			__typename: 'User',
			firstName: 'bob',
			favoriteColors: ['red', 'green', 'blue'],
			id: '1',
		},
	})
})

test('new __typename moves subscribers', function () {})

test.todo('can write to and resolve layers')

test.todo("resolving a layer with the same value as the most recent doesn't notify subscribers")
