import { test, expect, vi } from 'vitest'

import { testConfigFile } from '../../../test'
import { Cache } from '../cache'

const config = testConfigFile()

test('root subscribe - field change', function () {
	// instantiate a cache
	const cache = new Cache(config)

	const selection = {
		viewer: {
			type: 'User',
			keyRaw: 'viewer',
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

	const selection = {
		viewer: {
			type: 'User',
			keyRaw: 'viewer',
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
			firstName: {
				type: 'String',
				keyRaw: 'firstName',
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

	const selection = {
		viewer: {
			type: 'User',
			keyRaw: 'viewer',
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

	const selection = {
		viewer: {
			type: 'User',
			keyRaw: 'viewer',
			nullable: true,
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

	const selection = {
		viewer: {
			type: 'User',
			keyRaw: 'viewer',
			fields: {
				id: {
					type: 'ID',
					keyRaw: 'id',
				},
				friends: {
					type: 'User',
					keyRaw: 'friends',
					nullable: true,
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
			id: {
				type: 'String',
				keyRaw: 'id',
			},
			friends: selection.viewer.fields.friends,
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

	const selection = {
		viewer: {
			type: 'User',
			keyRaw: 'viewer',
			fields: {
				id: {
					type: 'ID',
					keyRaw: 'id',
				},
				friends: {
					type: 'User',
					keyRaw: 'friends',
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

	const selection = {
		viewer: {
			type: 'User',
			keyRaw: 'viewer',
			fields: {
				id: {
					type: 'ID',
					keyRaw: 'id',
				},
				friends: {
					type: 'User',
					keyRaw: 'friends',
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

	const selection = {
		viewer: {
			type: 'User',
			keyRaw: 'viewer',
			fields: {
				id: {
					type: 'ID',
					keyRaw: 'id',
				},
				friends: {
					type: 'User',
					keyRaw: 'friends',
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

	const selection = {
		viewer: {
			type: 'User',
			keyRaw: 'viewer',
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

	const selection = {
		viewer: {
			type: 'User',
			keyRaw: 'viewer',
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
			id: {
				type: 'String',
				keyRaw: 'id',
			},
			firstName: {
				type: 'String',
				keyRaw: 'firstName',
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
			id: {
				type: 'String',
				keyRaw: 'id',
			},
			firstName: {
				type: 'String',
				keyRaw: 'firstName',
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

	const selection = {
		viewer: {
			type: 'User',
			keyRaw: 'viewer',
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

	const selection = {
		viewer: {
			type: 'User',
			keyRaw: 'viewer',
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

	const selection = {
		viewer: {
			type: 'User',
			keyRaw: 'viewer',
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

	const selection = {
		viewer: {
			type: 'User',
			keyRaw: 'viewer',
			fields: {
				id: {
					type: 'ID',
					keyRaw: 'id',
				},
				friends: {
					type: 'User',
					keyRaw: 'friends',
					fields: {
						edges: {
							type: 'UserEdge',
							keyRaw: 'edges',
							fields: {
								node: {
									type: 'User',
									keyRaw: 'node',
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
			user: {
				type: 'User',
				keyRaw: 'user',
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

	const selection = {
		viewer: {
			type: 'User',
			keyRaw: 'viewer',
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

	const selection = {
		viewer: {
			type: 'User',
			keyRaw: 'viewer',
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

	const selection = {
		viewer: {
			type: 'User',
			keyRaw: 'viewer',
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

	const selection = {
		viewer: {
			type: 'User',
			keyRaw: 'viewer',
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


test('nested list receiving update from adding item to inner list', function () {
	// instantiate a cache
	const cache = new Cache(config);

	const selection = {
		cities: {
			type: "City",
			keyRaw: "cities",
			list: {
				name: "City_List",
				connection: false,
				type: "City"
			},
			fields: {
				id: {
					type: "ID",
					keyRaw: "id"
				},
				name: {
					type: "String",
					keyRaw: "name"
				},
				libraries: {
					type: "Library",
					keyRaw: "libraries",
					list: {
						name: "Library_List",
						connection: false,
						type: "Library"
					},
					fields: {
						id: {
							type: "ID",
							keyRaw: "id"
						},
						name: {
							type: "String",
							keyRaw: "name"
						},
						books: {
							type: "Book",
							keyRaw: "books",
							list: {
								name: "Book_List",
								connection: false,
								type: "Book"
							},
							fields: {
								id: {
									type: "ID",
									keyRaw: "id"
								},
								title: {
									type: "String",
									keyRaw: "title"
								}
							}
						}
					}
				}
			}
		}
	};

	const data = {
		cities: [
			{
				id: "1",
				name: "Alexandria",
				libraries: [
					{
						id: "1",
						name: "The Library of Alexandria",
						books: [
							{
								id: "1",
								title: "Callimachus Pinakes"
							},
							{
								id: "2",
								title: "Kutubkhana-i-lskandriyya"
							}
						]
					},
					{
						id: "2",
						name: "Bibliotheca Alexandrina",
						books: [
							{
								id: "3",
								title: "Analyze your own personality"
							}
						]
					}
				]
			},
			{
				id: "2",
				name: "Istanbul",
				libraries: [
					{
						id: "3",
						name: "The Imperial Library of Constantinople",
						books: [
							{
								id: "4",
								title: "Homer"
							},
							{
								id: "5",
								title: "The Hellenistic History"
							}
						]
					}
				]
			}
		]
	};

	// write the database
	cache.write({ selection, data });

	// add city
	cache.write({
		selection: {
			addCity: {
				type: "City",
				keyRaw: "addCity(name: $name)",
				operations: [
					{
						action: "insert",
						list: "City_List",
						position: "last"
					}
				],
				fields: {
					id: {
						type: "ID",
						keyRaw: "id"
					},
					name: {
						type: "String",
						keyRaw: "name"
					},
					libraries: {
						type: "Library",
						keyRaw: "libraries",
						list: {
							name: "Library_List",
							connection: false,
							type: "Library"
						},
						fields: {
							id: {
								type: "ID",
								keyRaw: "id"
							},
							name: {
								type: "String",
								keyRaw: "name"
							},
							books: {
								type: "Book",
								keyRaw: "books",
								list: {
									name: "Book_List",
									connection: false,
									type: "Book"
								},
								fields: {
									id: {
										type: "ID",
										keyRaw: "id"
									},
									title: {
										type: "String",
										keyRaw: "title"
									}
								}
							}
						}
					}
				}
			}
		},
		data: {
			addCity: {
				id: "3",
				name: "Aalborg",
				libraries: []
			}
		},
		variables: {
			name: "Aalborg"
		},
		forceNotify: true,
	});
	cache.write({
		selection: {
			newEntries: {
				keyRaw: "cities",
				type: "City",
				update: "append",
				fields: {
					id: {
						type: "ID",
						keyRaw: "id"
					},
					name: {
						type: "String",
						keyRaw: "name"
					},
					libraries: {
						type: "Library",
						keyRaw: "libraries",
						list: {
							name: "Library_List",
							connection: false,
							type: "Library"
						},
						fields: {
							id: {
								type: "ID",
								keyRaw: "id"
							},
							name: {
								type: "String",
								keyRaw: "name"
							},
							books: {
								type: "Book",
								keyRaw: "books",
								list: {
									name: "Book_List",
									connection: false,
									type: "Book"
								},
								fields: {
									id: {
										type: "ID",
										keyRaw: "id"
									},
									title: {
										type: "String",
										keyRaw: "title"
									}
								}
							}
						}
					},
					__typename: {
						keyRaw: "__typename",
						type: "String"
					}
				}
			}
		},
		data: {
			newEntries: [
				{
					id: "3",
					name: "Aalborg",
					libraries: [],
					__typename: "City"
				}
			]
		},
		variables: {
			name: "Aalborg"
		},
		applyUpdates: true,
	});

	// add library
	cache.write({
		selection: {
			addLibrary: {
				type: "Library",
				keyRaw: "addLibrary(city: $city, name: $name)",
				operations: [
					{
						action: "insert",
						list: "Library_List",
						position: "last",
						parentID: {
							kind: "Variable",
							value: "city"
						}
					}
				],
				fields: {
					id: {
						type: "ID",
						keyRaw: "id"
					},
					name: {
						type: "String",
						keyRaw: "name"
					},
					books: {
						type: "Book",
						keyRaw: "books",
						list: {
							name: "Book_List",
							connection: false,
							type: "Book"
						},
						fields: {
							id: {
								type: "ID",
								keyRaw: "id"
							},
							title: {
								type: "String",
								keyRaw: "title"
							}
						}
					}
				}
			}
		},
		data: {
			addLibrary: {
				id: "4",
				name: "Aalborg Bibliotekerne",
				books: []
			}
		},
		variables: {
			city: "3",
			name: "Aalborg Bibliotekerne"
		},
		forceNotify: true,
	});
	cache.write({
		selection: {
			newEntries: {
				keyRaw: "libraries",
				type: "Library",
				update: "append",
				fields: {
					id: {
						type: "ID",
						keyRaw: "id"
					},
					name: {
						type: "String",
						keyRaw: "name"
					},
					books: {
						type: "Book",
						keyRaw: "books",
						list: {
							name: "Book_List",
							connection: false,
							type: "Book"
						},
						fields: {
							id: {
								type: "ID",
								keyRaw: "id"
							},
							title: {
								type: "String",
								keyRaw: "title"
							}
						}
					},
					__typename: {
						keyRaw: "__typename",
						type: "String"
					}
				}
			}
		},
		data: {
			newEntries: [
				{
					id: "4",
					name: "Aalborg Bibliotekerne",
					books: [],
					__typename: "Library"
				}
			]
		},
		variables: {
			city: "3",
			name: "Aalborg Bibliotekerne"
		},
		parent: 'City:3',
		applyUpdates: true,
	});

	// a function to spy on that will play the role of set
	const set = vi.fn();

	// subscribe to the fields
	cache.subscribe({
		rootType: 'Query',
		selection,
		set,
	});

	// add book
	cache.write({
		selection: {
			addBook: {
				type: "Book",
				keyRaw: "addBook(library: $library, title: $title)",
				operations: [
					{
						action: "insert",
						list: "Book_List",
						position: "last",
						parentID: {
							kind: "Variable",
							value: "library"
						}
					}
				],
				fields: {
					id: {
						type: "ID",
						keyRaw: "id"
					},
					title: {
						type: "String",
						keyRaw: "title"
					}
				}
			}
		},
		data: {
			addBook: {
				id: "6",
				title: "Stone Blind"
			}
		},
		variables: {
			library: "4",
			title: "Stone Blind"
		},
		forceNotify: true,
	});
	cache.write({
		selection: {
			newEntries: {
				keyRaw: "books",
				type: "Book",
				update: "append",
				fields: {
					id: {
						type: "ID",
						keyRaw: "id"
					},
					title: {
						type: "String",
						keyRaw: "title"
					},
					__typename: {
						keyRaw: "__typename",
						type: "String"
					}
				}
			}
		},
		data: {
			newEntries: [
				{
					id: "6",
					title: "Stone Blind",
					__typename: "Book"
				}
			]
		},
		variables: {
			library: "4",
			title: "Stone Blind"
		},
		parent: 'Parent:4',
		applyUpdates: true,
	});

	// make sure that set got called with the full response containing new city, library, and book
	expect(set).toHaveBeenCalledWith({
		cities: [
			{
				id: "1",
				name: "Alexandria",
				libraries: [
					{
						id: "1",
						name: "The Library of Alexandria",
						books: [
							{
								id: "1",
								title: "Callimachus Pinakes"
							},
							{
								id: "2",
								title: "Kutubkhana-i-lskandriyya"
							}
						]
					},
					{
						id: "2",
						name: "Bibliotheca Alexandrina",
						books: [
							{
								id: "3",
								title: "Analyze your own personality"
							}
						]
					}
				]
			},
			{
				id: "2",
				name: "Istanbul",
				libraries: [
					{
						id: "3",
						name: "The Imperial Library of Constantinople",
						books: [
							{
								id: "4",
								title: "Homer"
							},
							{
								id: "5",
								title: "The Hellenistic History"
							}
						]
					}
				]
			},
			{
				id: "3",
				name: "Aalborg",
				libraries: [
					{
						id: "4",
						name: "Aalborg Bibliotekerne",
						books: [
							{
								id: "6",
								title: "Stone Blind"
							}
						]
					}
				]
			}
		]
	});
});

test.todo('can write to and resolve layers')

test.todo("resolving a layer with the same value as the most recent doesn't notify subscribers")
