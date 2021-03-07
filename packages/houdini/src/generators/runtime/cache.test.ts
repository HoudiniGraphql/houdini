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
				key: 'viewer',
				fields: {
					id: {
						type: 'ID',
						key: 'id',
					},
					firstName: {
						type: 'String',
						key: 'firstName',
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
				key: 'viewer',
				fields: {
					id: {
						type: 'ID',
						key: 'id',
					},
					firstName: {
						type: 'String',
						key: 'firstName',
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
				key: 'viewer',
				fields: {
					id: {
						type: 'ID',
						key: 'id',
					},
					lastName: {
						type: 'String',
						key: 'lastName',
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
	expect(cache.get(cache.id('User', { id: '1' }))?.fields).toEqual({
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
				key: 'viewer',
				fields: {
					id: {
						type: 'ID',
						key: 'id',
					},
					firstName: {
						type: 'String',
						key: 'firstName',
					},
					parent: {
						type: 'User',
						key: 'parent',
						fields: {
							id: {
								type: 'ID',
								key: 'id',
							},
							firstName: {
								type: 'String',
								key: 'firstName',
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
	const user1 = cache.get(cache.id('User', { id: '1' }))
	expect(user1?.fields).toEqual({
		id: '1',
		firstName: 'bob',
	})
	expect(user1?.linkedRecord('parent')?.fields).toEqual({
		id: '2',
		firstName: 'jane',
	})

	// check user 2
	const user2 = cache.get(cache.id('User', { id: '2' }))
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
				key: 'viewer',
				fields: {
					id: {
						type: 'ID',
						key: 'id',
					},
					firstName: {
						type: 'String',
						key: 'firstName',
					},
					parent: {
						type: 'User',
						key: 'parent',
						fields: {
							id: {
								type: 'ID',
								key: 'id',
							},
							firstName: {
								type: 'String',
								key: 'firstName',
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
				key: 'viewer',
				fields: {
					id: {
						type: 'ID',
						key: 'id',
					},
					firstName: {
						type: 'String',
						key: 'firstName',
					},
					friends: {
						type: 'User',
						key: 'friends',
						fields: {
							id: {
								type: 'ID',
								key: 'id',
							},
							firstName: {
								type: 'String',
								key: 'firstName',
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
		.get(cache.id('User', { id: '1' }))
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
				key: 'viewer',
				fields: {
					id: {
						type: 'ID',
						key: 'id',
					},
					firstName: {
						type: 'String',
						key: 'firstName',
					},
					favoriteColors: {
						type: 'String',
						key: 'favoriteColors(where: "foo")',
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
	expect(
		cache.get(cache.id('User', { id: '1' }))?.fields['favoriteColors(where: "foo")']
	).toEqual(['red', 'green', 'blue'])
})

test('root subscribe - field change', function () {
	// instantiate a cache
	const cache = new Cache()

	const selection = {
		viewer: {
			type: 'User',
			key: 'viewer',
			fields: {
				id: {
					type: 'ID',
					key: 'id',
				},
				firstName: {
					type: 'String',
					key: 'firstName',
				},
				favoriteColors: {
					type: 'String',
					key: 'favoriteColors',
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
			key: 'viewer',
			fields: {
				id: {
					type: 'ID',
					key: 'id',
				},
				firstName: {
					type: 'String',
					key: 'firstName',
				},
				favoriteColors: {
					type: 'String',
					key: 'favoriteColors(where: "foo")',
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
	expect(cache.get(cache.id('User', { id: '1' }))?.getSubscribers('firstName')).toHaveLength(0)
})

test('root subscribe - linked list lost entry', function () {
	// instantiate a cache
	const cache = new Cache()

	const selection = {
		viewer: {
			type: 'User',
			key: 'viewer',
			fields: {
				id: {
					type: 'ID',
					key: 'id',
				},
				friends: {
					type: 'User',
					key: 'friends',
					fields: {
						id: {
							type: 'ID',
							key: 'id',
						},
						firstName: {
							type: 'String',
							key: 'firstName',
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
	expect(cache.get(cache.id('User', { id: '3' }))?.getSubscribers('firstName')).toHaveLength(0)
})

test('root subscribe - linked list reorder', function () {
	// instantiate a cache
	const cache = new Cache()

	const selection = {
		viewer: {
			type: 'User',
			key: 'viewer',
			fields: {
				id: {
					type: 'ID',
					key: 'id',
				},
				friends: {
					type: 'User',
					key: 'friends',
					fields: {
						id: {
							type: 'ID',
							key: 'id',
						},
						firstName: {
							type: 'String',
							key: 'firstName',
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
	expect(cache.get(cache.id('User', { id: '2' }))?.getSubscribers('firstName')).toHaveLength(1)
	expect(cache.get(cache.id('User', { id: '3' }))?.getSubscribers('firstName')).toHaveLength(1)
})

test('unsubscribe', function () {
	// instantiate a cache
	const cache = new Cache()

	const selection = {
		viewer: {
			type: 'User',
			key: 'viewer',
			fields: {
				id: {
					type: 'ID',
					key: 'id',
				},
				firstName: {
					type: 'String',
					key: 'firstName',
				},
				favoriteColors: {
					type: 'String',
					key: 'favoriteColors(where: "foo")',
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
	expect(cache.get(cache.id('User', { id: '1' }))?.getSubscribers('firstName')).toHaveLength(1)

	// unsubscribe
	cache.unsubscribe(spec)

	// make sure there is no more subscriber
	expect(cache.get(cache.id('User', { id: '1' }))?.getSubscribers('firstName')).toHaveLength(0)
})

test('insert in connection', function () {
	// instantiate a cache
	const cache = new Cache()

	const selection = {
		viewer: {
			type: 'User',
			key: 'viewer',
			fields: {
				id: {
					type: 'ID',
					key: 'id',
				},
				friends: {
					type: 'User',
					key: 'friends',
					connection: 'All_Users',
					fields: {
						id: {
							type: 'ID',
							key: 'id',
						},
						firstName: {
							type: 'String',
							key: 'firstName',
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
		{ id: { type: 'ID', key: 'id' }, firstName: { type: 'String', key: 'firstName' } },
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
			key: 'viewer',
			fields: {
				id: {
					type: 'ID',
					key: 'id',
				},
				friends: {
					type: 'User',
					key: 'friends',
					connection: 'All_Users',
					fields: {
						id: {
							type: 'ID',
							key: 'id',
						},
						firstName: {
							type: 'String',
							key: 'firstName',
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
		{ id: { type: 'ID', key: 'id' }, firstName: { type: 'String', key: 'firstName' } },
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
			key: 'viewer',
			fields: {
				id: {
					type: 'ID',
					key: 'id',
				},
				friends: {
					type: 'User',
					key: 'friends',
					connection: 'All_Users',
					fields: {
						id: {
							type: 'ID',
							key: 'id',
						},
						firstName: {
							type: 'String',
							key: 'firstName',
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
	expect(cache.get(cache.id('User', { id: '2' }))?.getSubscribers('firstName')).toHaveLength(0)
})

test('delete node', function () {
	// instantiate a cache
	const cache = new Cache()

	const selection = {
		viewer: {
			type: 'User',
			key: 'viewer',
			fields: {
				id: {
					type: 'ID',
					key: 'id',
				},
				friends: {
					type: 'User',
					key: 'friends',
					connection: 'All_Users',
					fields: {
						id: {
							type: 'ID',
							key: 'id',
						},
						firstName: {
							type: 'String',
							key: 'firstName',
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
	expect(cache.get(cache.id('User', { id: '2' }))?.getSubscribers('firstName')).toHaveLength(0)
})

test.todo('insert operation')

test.todo('remove operation')

test.todo('delete operation')

// atm when we remove subscribers from links we assume its the only reason that spec is associated
// with the field. that's not the case if the same record shows up two places in a query but is removed
// as a link in only one of them (this also included connections)
test.todo("removing link doesn't unregister the same set everywhere")

test.todo('unsubscribe removes connection handlers')

test.todo('nested linked record update')

test.todo('nested linked list update')

test.todo('insert connection under parentID')

test.todo('caches fields with args')
