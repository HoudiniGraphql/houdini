// external imports
import { testConfig } from 'houdini-common'
// locals
import { Cache, rootID } from '../cache'
import { SubscriptionSelection } from '../../types'

const config = testConfig()

test('save root object', function () {
	// instantiate a cache we'll test against
	const cache = new Cache(config)

	// save the data
	const data = {
		viewer: {
			id: '1',
			firstName: 'bob',
		},
	}
	cache.write({
		selection: {
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
				},
			},
		},
		data,
	})

	// make sure we can get back what we wrote
	expect(cache.internal.getRecord(cache.id('User', data.viewer)!)?.fields).toEqual({
		id: '1',
		firstName: 'bob',
	})
})

test('partial update existing record', function () {
	// instantiate a cache we'll test against
	const cache = new Cache(config)

	// save the data
	cache.write({
		selection: {
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
				},
			},
		},
		data: {
			viewer: {
				id: '1',
				firstName: 'bob',
			},
		},
	})

	cache.write({
		selection: {
			viewer: {
				type: 'User',
				keyRaw: 'viewer',
				fields: {
					id: {
						type: 'ID',
						keyRaw: 'id',
					},
					lastName: {
						type: 'String',
						keyRaw: 'lastName',
					},
				},
			},
		},
		data: {
			viewer: {
				id: '1',
				lastName: 'barker',
			},
		},
	})

	// make sure we can get back what we wrote
	expect(cache.internal.getRecord(cache.id('User', '1')!)?.fields).toEqual({
		id: '1',
		firstName: 'bob',
		lastName: 'barker',
	})
})

test('linked records with updates', function () {
	// instantiate a cache we'll test against
	const cache = new Cache(config)

	// save the data
	cache.write({
		selection: {
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
					parent: {
						type: 'User',
						keyRaw: 'parent',
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
			viewer: {
				id: '1',
				firstName: 'bob',
				parent: {
					id: '2',
					firstName: 'jane',
				},
			},
		},
	})

	// check user 1
	const user1 = cache.internal.getRecord(cache.id('User', '1')!)
	expect(user1?.fields).toEqual({
		id: '1',
		firstName: 'bob',
	})
	expect(user1?.linkedRecord('parent')?.fields).toEqual({
		id: '2',
		firstName: 'jane',
	})

	// check user 2
	const user2 = cache.internal.getRecord(cache.id('User', '2')!)
	expect(user2?.fields).toEqual({
		id: '2',
		firstName: 'jane',
	})
	expect(user2?.linkedRecord('parent')).toBeFalsy()

	// associate user2 with a new parent
	cache.write({
		selection: {
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
					parent: {
						type: 'User',
						keyRaw: 'parent',
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
			viewer: {
				id: '2',
				firstName: 'jane-prime',
				parent: {
					id: '3',
					firstName: 'mary',
				},
			},
		},
	})

	// make sure we updated user 2
	expect(user2?.fields).toEqual({
		id: '2',
		firstName: 'jane-prime',
	})
	expect(user2?.linkedRecord('parent')?.fields).toEqual({
		id: '3',
		firstName: 'mary',
	})
})

test('linked lists', function () {
	// instantiate the cache
	const cache = new Cache(config)

	// add some data to the cache
	cache.write({
		selection: {
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
						},
					},
				},
			},
		},
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
	const friendData = cache.internal
		.getRecord(cache.id('User', '1')!)
		?.flatLinkedList('friends')
		.map((data) => data!.fields)
	expect(friendData).toEqual([
		{
			id: '2',
			firstName: 'jane',
		},
		{
			id: '3',
			firstName: 'mary',
		},
	])
})

test('list as value with args', function () {
	// instantiate the cache
	const cache = new Cache(config)

	// add some data to the cache
	cache.write({
		selection: {
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
		},
		data: {
			viewer: {
				id: '1',
				firstName: 'bob',
				favoriteColors: ['red', 'green', 'blue'],
			},
		},
	})

	// look up the value
	expect(
		cache.internal.getRecord(cache.id('User', '1')!)?.fields['favoriteColors(where: "foo")']
	).toEqual(['red', 'green', 'blue'])
})

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
	const set = jest.fn()

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
	const set = jest.fn()

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
				// ignoring favoriteColors as a sanity check (should get undefined)
			},
		},
	})

	// make sure that set got called with the full response
	expect(set).toHaveBeenCalledWith({
		viewer: {
			firstName: 'mary',
			// this is a sanity-check. the cache wasn't written with that value
			favoriteColors: undefined,
			id: '2',
		},
	})

	// make sure we are no longer subscribing to user 1
	expect(
		cache.internal.getRecord(cache.id('User', '1')!)?.getSubscribers('firstName')
	).toHaveLength(0)
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
	const set = jest.fn()

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
			favoriteColors: undefined,
			id: '2',
		},
	})
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
	const set = jest.fn()

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
	expect(
		cache.internal.getRecord(cache.id('User', '3')!)?.getSubscribers('firstName')
	).toHaveLength(0)
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
	const set = jest.fn()

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
	const set = jest.fn()

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
	expect(
		cache.internal.getRecord(cache.id('User', '2')!)?.getSubscribers('firstName')
	).toHaveLength(1)
	expect(
		cache.internal.getRecord(cache.id('User', '3')!)?.getSubscribers('firstName')
	).toHaveLength(1)
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
		set: jest.fn(),
	}

	// subscribe to the fields
	cache.subscribe(spec)

	// make sure we  registered the subscriber
	expect(
		cache.internal.getRecord(cache.id('User', '1')!)?.getSubscribers('firstName')
	).toHaveLength(1)

	// unsubscribe
	cache.unsubscribe(spec)

	// make sure there is no more subscriber
	expect(
		cache.internal.getRecord(cache.id('User', '1')!)?.getSubscribers('firstName')
	).toHaveLength(0)
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
	const set = jest.fn()

	// subscribe to the fields
	cache.subscribe({
		rootType: 'Query',
		set,
		selection,
	})

	// insert an element into the list (no parent ID)
	cache.list('All_Users').append(
		{ id: { type: 'ID', keyRaw: 'id' }, firstName: { type: 'String', keyRaw: 'firstName' } },
		{
			id: '3',
			firstName: 'mary',
		}
	)

	// update the user we just added
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
						firstName: 'mary-prime',
					},
				],
			},
		},
	})

	// the first time set was called, a new entry was added.
	// the second time it's called, we get a new value for mary-prime
	expect(set).toHaveBeenNthCalledWith(2, {
		viewer: {
			id: '1',
			friends: [
				{
					firstName: 'jane',
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
	const set = jest.fn()

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
	expect(cache.list('All_Users').key).toEqual('friends(filter: "foo")')

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
	expect(
		cache.internal.getRecord(cache.id('User', '3')!)?.getSubscribers('firstName')
	).toHaveLength(0)
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
	const set = jest.fn()

	// subscribe to the fields
	cache.subscribe({
		rootType: 'Query',
		selection,
		set,
	})

	// sanity check
	expect(cache.internal.getRecord('User:2')?.getSubscribers('firstName')).toHaveLength(1)

	// delete the parent
	cache.delete('User', 'User:1')

	// sanity check
	expect(cache.internal.getRecord('User:2')?.getSubscribers('firstName')).toHaveLength(0)
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
	const set = jest.fn()

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
	expect(cache.internal.getRecord('User:1')?.getSubscribers('firstName')).toHaveLength(1)

	// remove the user from the list
	cache.list('All_Users').remove({ id: '1' })

	// we should still be subscribing to the user's first name
	expect(cache.internal.getRecord('User:1')?.getSubscribers('firstName')).toHaveLength(1)
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
	const set = jest.fn()

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

describe('key evaluation', function () {
	const table = [
		{
			title: 'string',
			key: 'fieldName',
			variables: {},
			expected: 'fieldName',
		},
		{
			title: 'variable',
			key: 'fieldName(foo: $bar)',
			variables: { bar: 'baz' },
			expected: 'fieldName(foo: "baz")',
		},
		{
			title: '$ in string',
			key: 'fieldName(foo: "$bar")',
			variables: { bar: 'baz' },
			expected: 'fieldName(foo: "$bar")',
		},
		{
			title: 'undefined variable',
			key: 'fieldName(foo: $bar)',
			variables: {},
			expected: 'fieldName(foo: undefined)',
		},
	]

	for (const row of table) {
		test(row.title, function () {
			const cache = new Cache(config)

			expect(cache.internal.evaluateKey(row.key, row.variables)).toEqual(row.expected)
		})
	}
})

test('writing abstract objects', function () {
	// instantiate a cache we'll test against
	const cache = new Cache(config)

	// save the data
	const data = {
		viewer: {
			__typename: 'User',
			id: '1',
			firstName: 'bob',
		},
	}
	cache.write({
		selection: {
			viewer: {
				type: 'Node',
				abstract: true,
				keyRaw: 'viewer',
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
		data,
	})

	// make sure we can get back what we wrote
	expect(cache.internal.getRecord(cache.id('User', data.viewer)!)?.fields).toEqual({
		__typename: 'User',
		id: '1',
		firstName: 'bob',
	})
})

test('writing abstract lists', function () {
	// instantiate a cache we'll test against
	const cache = new Cache(config)

	// save the data
	const data = {
		nodes: [
			{
				__typename: 'User',
				id: '1',
				firstName: 'bob',
			},
			{
				__typename: 'User',
				id: '2',
				firstName: 'bob',
			},
		],
	}
	cache.write({
		selection: {
			nodes: {
				type: 'Node',
				abstract: true,
				keyRaw: 'nodes',
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
		data,
	})

	// make sure we can get back what we wrote
	expect(cache.internal.getRecord('User:1')?.fields).toEqual({
		__typename: 'User',
		id: '1',
		firstName: 'bob',
	})
})

test('can pull enum from cached values', function () {
	// instantiate a cache we'll test against
	const cache = new Cache(config)

	// the selection we are gonna write
	const selection = {
		node: {
			type: 'Node',
			keyRaw: 'node',
			fields: {
				enumValue: {
					type: 'MyEnum',
					keyRaw: 'enumValue',
				},
				id: {
					type: 'ID',
					keyRaw: 'id',
				},
			},
		},
	}

	// save the data
	const data = {
		node: {
			id: '1',
			enumValue: 'Hello',
		},
	}

	// write the data to cache
	cache.write({ selection, data })

	// pull the data out of the cache
	expect(cache.internal.getData(cache.internal.record(rootID), selection, {})).toEqual({
		node: {
			id: '1',
			enumValue: 'Hello',
		},
	})
})

test('can store and retrieve lists with null values', function () {
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
					null,
				],
			},
		},
	})

	// make sure we can get the linked lists back
	expect(cache.internal.getData(cache.internal.record(rootID), selection, {})).toEqual({
		viewer: {
			id: '1',
			firstName: 'bob',
			friends: [
				{
					id: '2',
					firstName: 'jane',
				},
				null,
			],
		},
	})
})

test('can store and retrieve lists of lists of records', function () {
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
					[
						{
							id: '2',
							firstName: 'jane',
						},
						null,
					],
					[
						{
							id: '3',
							firstName: 'jane',
						},
						{
							id: '4',
							firstName: 'jane',
						},
					],
				],
			},
		},
	})

	// make sure we can get the linked lists back
	expect(cache.internal.getData(cache.internal.record(rootID), selection, {})).toEqual({
		viewer: {
			id: '1',
			firstName: 'bob',
			friends: [
				[
					{
						id: '2',
						firstName: 'jane',
					},
					null,
				],
				[
					{
						id: '3',
						firstName: 'jane',
					},
					{
						id: '4',
						firstName: 'jane',
					},
				],
			],
		},
	})
})

test('can store and retrieve links with null values', function () {
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
					},
				},
			},
		},
	}

	// add some data to the cache
	cache.write({
		selection,
		data: {
			viewer: null,
		},
	})

	// make sure we can get the linked record back
	expect(cache.internal.getData(cache.internal.record(rootID), selection, {})).toEqual({
		viewer: null,
	})
})

test('can write list of just null', function () {
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
				friends: [null],
			},
		},
	})

	// make sure we can get the linked lists back
	expect(cache.internal.getData(cache.internal.record(rootID), selection, {})).toEqual({
		viewer: {
			id: '1',
			firstName: 'bob',
			friends: [null],
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
		set: jest.fn(),
		selection,
		rootType: 'Query',
	}
	cache.subscribe(spec)
	cache.unsubscribe(spec)

	// no one should be subscribing to User:1's first name
	expect(
		cache.internal.getRecord(cache.id('User', '1')!)?.getSubscribers('firstName')
	).toHaveLength(0)
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
		set: jest.fn(),
		selection,
		rootType: 'Query',
	}
	cache.subscribe(spec)
	cache.unsubscribe(spec)

	// no one should be subscribing to User:1's first name
	expect(
		cache.internal.getRecord(cache.id('User', '1')!)?.getSubscribers('firstName')
	).toHaveLength(0)
})

test.todo('inserting node creates back reference to list')

test.todo('unsubscribe removes list handlers')

test.todo('nested linked record update')

test.todo('nested linked list update')
