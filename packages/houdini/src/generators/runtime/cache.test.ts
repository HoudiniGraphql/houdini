// locals
import { Cache } from './template/cache'
import { MutationOperation, SubscriptionSelection } from './template/types'

test('save root object', function () {
	// instantiate a cache we'll test against
	const cache = new Cache()

	// save the data
	const data = {
		viewer: {
			id: '1',
			firstName: 'bob',
		},
	}
	cache.write(
		{
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
		{}
	)

	// make sure we can get back what we wrote
	expect(cache.get(cache.id('User', data.viewer))?.fields).toEqual({
		id: '1',
		firstName: 'bob',
	})
})

test('partial update existing record', function () {
	// instantiate a cache we'll test against
	const cache = new Cache()

	// save the data
	cache.write(
		{
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
		{
			viewer: {
				id: '1',
				firstName: 'bob',
			},
		},
		{}
	)

	cache.write(
		{
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
		{
			viewer: {
				id: '1',
				lastName: 'geldof',
			},
		},
		{}
	)

	// make sure we can get back what we wrote
	expect(cache.get(cache.id('User', '1'))?.fields).toEqual({
		id: '1',
		firstName: 'bob',
		lastName: 'geldof',
	})
})

test('linked records with updates', function () {
	// instantiate a cache we'll test against
	const cache = new Cache()

	// save the data
	cache.write(
		{
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
		{
			viewer: {
				id: '1',
				firstName: 'bob',
				parent: {
					id: '2',
					firstName: 'jane',
				},
			},
		},
		{}
	)

	// check user 1
	const user1 = cache.get(cache.id('User', '1'))
	expect(user1?.fields).toEqual({
		id: '1',
		firstName: 'bob',
	})
	expect(user1?.linkedRecord('parent')?.fields).toEqual({
		id: '2',
		firstName: 'jane',
	})

	// check user 2
	const user2 = cache.get(cache.id('User', '2'))
	expect(user2?.fields).toEqual({
		id: '2',
		firstName: 'jane',
	})
	expect(user2?.linkedRecord('parent')).toBeNull()

	// associate user2 with a new parent
	cache.write(
		{
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
		{
			viewer: {
				id: '2',
				firstName: 'jane-prime',
				parent: {
					id: '3',
					firstName: 'mary',
				},
			},
		},
		{}
	)

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
	const cache = new Cache()

	// add some data to the cache
	cache.write(
		{
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
		{
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
		{}
	)

	// make sure we can get the linked lists back
	const friendData = cache
		.get(cache.id('User', '1'))
		?.linkedList('friends')
		.map(({ fields }) => fields)
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
	const cache = new Cache()

	// add some data to the cache
	cache.write(
		{
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
		{
			viewer: {
				id: '1',
				firstName: 'bob',
				favoriteColors: ['red', 'green', 'blue'],
			},
		},
		{}
	)

	// look up the value
	expect(cache.get(cache.id('User', '1'))?.fields['favoriteColors(where: "foo")']).toEqual([
		'red',
		'green',
		'blue',
	])
})

test('root subscribe - field change', function () {
	// instantiate a cache
	const cache = new Cache()

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
	cache.write(
		selection,
		{
			viewer: {
				id: '1',
				firstName: 'bob',
				favoriteColors: ['red', 'green', 'blue'],
			},
		},
		{}
	)

	// a function to spy on that will play the role of set
	const set = jest.fn()

	// subscribe to the fields
	cache.subscribe({
		rootType: 'Query',
		selection,
		set,
	})

	// somehow write a user to the cache with the same id, but a different name
	cache.write(
		selection,
		{
			viewer: {
				id: '1',
				firstName: 'mary',
			},
		},
		{}
	)

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
	const cache = new Cache()

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
	cache.write(
		selection,
		{
			viewer: {
				id: '1',
				firstName: 'bob',
				favoriteColors: ['red', 'green', 'blue'],
			},
		},
		{}
	)

	// a function to spy on that will play the role of set
	const set = jest.fn()

	// subscribe to the fields
	cache.subscribe({
		rootType: 'Query',
		selection,
		set,
	})

	// somehow write a user to the cache with a different id
	cache.write(
		selection,
		{
			viewer: {
				id: '2',
				firstName: 'mary',
				// ignoring favoriteColors as a sanity check (should get undefined)
			},
		},
		{}
	)

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
	expect(cache.get(cache.id('User', '1'))?.getSubscribers('firstName')).toHaveLength(0)
})

test('root subscribe - linked list lost entry', function () {
	// instantiate a cache
	const cache = new Cache()

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
	cache.write(
		selection,
		{
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
		{}
	)

	// a function to spy on that will play the role of set
	const set = jest.fn()

	// subscribe to the fields
	cache.subscribe({
		rootType: 'Query',
		selection,
		set,
	})

	// somehow write a user to the cache with a new friends list
	cache.write(
		selection,
		{
			viewer: {
				id: '1',
				friends: [
					{
						id: '2',
					},
				],
			},
		},
		{}
	)

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
	expect(cache.get(cache.id('User', '3'))?.getSubscribers('firstName')).toHaveLength(0)
})

test('root subscribe - linked list reorder', function () {
	// instantiate a cache
	const cache = new Cache()

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
	cache.write(
		selection,
		{
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
		{}
	)

	// a function to spy on that will play the role of set
	const set = jest.fn()

	// subscribe to the fields
	cache.subscribe({
		rootType: 'Query',
		set,
		selection,
	})

	// somehow write a user to the cache with the same id, but a different name
	cache.write(
		selection,
		{
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
		{}
	)

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
	expect(cache.get(cache.id('User', '2'))?.getSubscribers('firstName')).toHaveLength(1)
	expect(cache.get(cache.id('User', '3'))?.getSubscribers('firstName')).toHaveLength(1)
})

test('unsubscribe', function () {
	// instantiate a cache
	const cache = new Cache()

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
	cache.write(
		selection,
		{
			viewer: {
				id: '1',
				firstName: 'bob',
				favoriteColors: ['red', 'green', 'blue'],
			},
		},
		{}
	)

	// the spec we will register/unregister
	const spec = {
		rootType: 'Query',
		selection,
		set: jest.fn(),
	}

	// subscribe to the fields
	cache.subscribe(spec)

	// make sure we  registered the subscriber
	expect(cache.get(cache.id('User', '1'))?.getSubscribers('firstName')).toHaveLength(1)

	// unsubscribe
	cache.unsubscribe(spec)

	// make sure there is no more subscriber
	expect(cache.get(cache.id('User', '1'))?.getSubscribers('firstName')).toHaveLength(0)
})

test('insert in connection', function () {
	// instantiate a cache
	const cache = new Cache()

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
					connection: 'All_Users',
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
	cache.write(
		selection,
		{
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
		{}
	)

	// a function to spy on that will play the role of set
	const set = jest.fn()

	// subscribe to the fields
	cache.subscribe({
		rootType: 'Query',
		set,
		selection,
	})

	// insert an element into the connection (no parent ID)
	cache.connection('All_Users').append(
		{ id: { type: 'ID', keyRaw: 'id' }, firstName: { type: 'String', keyRaw: 'firstName' } },
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

test('subscribe to new connection nodes', function () {
	// instantiate a cache
	const cache = new Cache()

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
					connection: 'All_Users',
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
	cache.write(
		selection,
		{
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
		{}
	)

	// a function to spy on that will play the role of set
	const set = jest.fn()

	// subscribe to the fields
	cache.subscribe({
		rootType: 'Query',
		set,
		selection,
	})

	// insert an element into the connection (no parent ID)
	cache.connection('All_Users').append(
		{ id: { type: 'ID', keyRaw: 'id' }, firstName: { type: 'String', keyRaw: 'firstName' } },
		{
			id: '3',
			firstName: 'mary',
		}
	)

	// update the user we just added
	cache.write(
		selection,
		{
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
		{}
	)

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

test('remove from connection', function () {
	// instantiate a cache
	const cache = new Cache()

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
					connection: 'All_Users',
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
	cache.write(
		selection,
		{
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
		{}
	)

	// a function to spy on that will play the role of set
	const set = jest.fn()

	// subscribe to the fields
	cache.subscribe({
		rootType: 'Query',
		set,
		selection: selection,
	})

	// remove user 2 from the connection
	cache.connection('All_Users').remove({
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
	expect(cache.get(cache.id('User', '2'))?.getSubscribers('firstName')).toHaveLength(0)
})

test('delete node', function () {
	// instantiate a cache
	const cache = new Cache()

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
					connection: 'All_Users',
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
	cache.write(
		selection,
		{
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
		{}
	)

	// a function to spy on that will play the role of set
	const set = jest.fn()

	// subscribe to the fields
	cache.subscribe({
		rootType: 'Query',
		set,
		selection,
	})

	// remove user 2 from the connection
	cache.delete(
		cache.id('User', {
			id: '2',
		})
	)

	// we should have been updated with an empty list
	expect(set).toHaveBeenCalledWith({
		viewer: {
			id: '1',
			friends: [],
		},
	})

	// make sure we aren't subscribing to user 2 any more
	expect(cache.get(cache.id('User', '2'))?.getSubscribers('firstName')).toHaveLength(0)
})

test('append operation', function () {
	// instantiate a cache
	const cache = new Cache()

	// create a connection we will add to
	cache.write(
		{
			viewer: {
				type: 'User',
				keyRaw: 'viewer',
				fields: {
					id: {
						type: 'ID',
						keyRaw: 'id',
					},
				},
			},
		},
		{
			viewer: {
				id: '1',
			},
		},
		{}
	)

	// subscribe to the data to register the connection
	cache.subscribe(
		{
			rootType: 'User',
			selection: {
				friends: {
					type: 'User',
					keyRaw: 'friends',
					connection: 'All_Users',
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
			parentID: cache.id('User', '1'),
			set: jest.fn(),
		},
		{}
	)

	// write some data to a different location with a new user
	// that should be added to the connection
	cache.write(
		{
			newUser: {
				type: 'User',
				keyRaw: 'newUser',
				operations: [
					{
						action: 'insert',
						connection: 'All_Users',
						parentID: {
							kind: 'String',
							value: cache.id('User', '1'),
						},
					},
				],
				fields: {
					id: {
						type: 'ID',
						keyRaw: 'id',
					},
				},
			},
		},
		{
			newUser: {
				id: '3',
			},
		},
		{}
	)

	// make sure we just added to the connection
	expect([...cache.connection('All_Users', cache.id('User', '1'))]).toHaveLength(1)
})

test('remove operation', function () {
	// instantiate a cache
	const cache = new Cache()

	// create a connection we will add to
	cache.write(
		{
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
		},
		{
			viewer: {
				id: '1',
				friends: [{ id: '2', firstName: 'jane' }],
			},
		},
		{}
	)

	// subscribe to the data to register the connection
	cache.subscribe(
		{
			rootType: 'User',
			selection: {
				friends: {
					type: 'User',
					keyRaw: 'friends',
					connection: 'All_Users',
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
			parentID: cache.id('User', '1'),
			set: jest.fn(),
		},
		{}
	)

	// write some data to a different location with a new user
	// that should be added to the connection
	cache.write(
		{
			newUser: {
				type: 'User',
				keyRaw: 'newUser',
				operations: [
					{
						action: 'remove',
						connection: 'All_Users',
						parentID: {
							kind: 'String',
							value: cache.id('User', '1'),
						},
					},
				],
				fields: {
					id: {
						type: 'ID',
						keyRaw: 'id',
					},
				},
			},
		},
		{
			newUser: {
				id: '2',
			},
		},
		{}
	)

	// make sure we removed the element from the connection
	expect([...cache.connection('All_Users', cache.id('User', '1'))]).toHaveLength(0)
})

test('delete operation', function () {
	// instantiate a cache
	const cache = new Cache()

	// create a connection we will add to
	cache.write(
		{
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
		},
		{
			viewer: {
				id: '1',
				friends: [{ id: '2', firstName: 'jane' }],
			},
		},
		{}
	)

	// subscribe to the data to register the connection
	cache.subscribe(
		{
			rootType: 'User',
			selection: {
				friends: {
					type: 'User',
					keyRaw: 'friends',
					connection: 'All_Users',
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
			parentID: cache.id('User', '1'),
			set: jest.fn(),
		},
		{}
	)

	// write some data to a different location with a new user
	// that should be added to the connection
	cache.write(
		{
			deleteUser: {
				type: 'User',
				keyRaw: 'deleteUser',
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
		{
			deleteUser: {
				id: '2',
			},
		},
		{}
	)

	// make sure we removed the element from the connection
	expect([...cache.connection('All_Users', cache.id('User', '1'))]).toHaveLength(0)
})

test('variables in query and subscription', function () {
	// instantiate a cache
	const cache = new Cache()

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
					connection: 'All_Users',
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
	cache.write(
		selection,
		{
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
		{
			filter: 'foo',
		}
	)

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

	// make sure we have a cached value for friends(filter: "foo")
	expect(cache.connection('All_Users').key).toEqual('friends(filter: "foo")')

	// somehow write a user to the cache with a new friends list
	cache.write(
		selection,
		{
			viewer: {
				id: '1',
				friends: [
					{
						id: '2',
					},
				],
			},
		},
		{
			filter: 'foo',
		}
	)

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
	expect(cache.get(cache.id('User', '3'))?.getSubscribers('firstName')).toHaveLength(0)
})

test('changing variables clears subscribers', function () {
	// instantiate a cache
	const cache = new Cache()

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
					connection: 'All_Users',
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
	cache.write(
		selection,
		{
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
		{
			filter: 'foo',
		}
	)

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

	// there should be a subscriber for the current value of `filter`
	expect(cache.get(cache.id('User', '1')).getSubscribers('friends(filter: "foo")')).toHaveLength(
		1
	)

	// subscribe to a different value
	cache.subscribe(
		{
			rootType: 'Query',
			selection,
			set,
		},
		{
			filter: 'not-foo',
		}
	)

	// make sure we have a subscriber for the new filter and none for the old
	expect(
		cache.get(cache.id('User', '1')).getSubscribers('friends(filter: "not-foo")')
	).toHaveLength(1)
	expect(cache.get(cache.id('User', '1')).getSubscribers('friends(filter: "foo")')).toHaveLength(
		0
	)
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
			const cache = new Cache()

			expect(cache.evaluateKey(row.key, row.variables)).toEqual(row.expected)
		})
	}
})

// atm when we remove subscribers from links we assume its the only reason that spec is associated
// with the field. that's not the case if the same record shows up two places in a query but is removed
// as a link in only one of them (this also included connections)
test.todo("removing link doesn't unregister the same set everywhere")

test.todo('unsubscribe removes connection handlers')

test.todo('nested linked record update')

test.todo('nested linked list update')
