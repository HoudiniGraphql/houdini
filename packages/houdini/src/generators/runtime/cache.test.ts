// locals
import { Cache } from './template/cache'

// the type information
const responseInfo = {
	rootType: 'Query',
	fields: {
		Query: {
			viewer: { type: 'User', key: 'viewer' },
		},
		User: {
			parent: { type: 'User', key: 'parent' },
			friends: { type: 'User', key: 'friends' },
			id: { type: 'String', key: 'id' },
			firstName: { type: 'String', key: 'firstName' },
			lastName: { type: 'String', key: 'lastName' },
			favoriteColors: { type: 'String', key: 'favoriteColors(where: "foo")' },
		},
	},
}

describe('store', function () {
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
		cache.write(responseInfo, data)

		// make sure we can get back what we wrote
		expect(cache.get(cache.id('User', data.viewer)).fields).toEqual(data.viewer)
	})

	test('partial update existing record', function () {
		// instantiate a cache we'll test against
		const cache = new Cache()

		// save the data
		cache.write(responseInfo, {
			viewer: {
				id: '1',
				firstName: 'bob',
			},
		})

		cache.write(responseInfo, {
			viewer: {
				id: '1',
				lastName: 'geldof',
			},
		})

		// make sure we can get back what we wrote
		expect(cache.get(cache.id('User', { id: '1' })).fields).toEqual({
			id: '1',
			firstName: 'bob',
			lastName: 'geldof',
		})
	})

	test('linked records with updates', function () {
		// instantiate a cache we'll test against
		const cache = new Cache()

		// save the data
		cache.write(responseInfo, {
			viewer: {
				id: '1',
				firstName: 'bob',
				parent: {
					id: '2',
					firstName: 'jane',
				},
			},
		})

		// check user 1
		const user1 = cache.get(cache.id('User', { id: '1' }))
		expect(user1.fields).toEqual({
			id: '1',
			firstName: 'bob',
		})
		expect(user1.linkedRecord('parent').fields).toEqual({
			id: '2',
			firstName: 'jane',
		})

		// check user 2
		const user2 = cache.get(cache.id('User', { id: '2' }))
		expect(user2.fields).toEqual({
			id: '2',
			firstName: 'jane',
		})
		expect(user2.linkedRecord('parent')).toBeNull()

		// associate user2 with a new parent
		cache.write(responseInfo, {
			viewer: {
				id: '2',
				firstName: 'jane-prime',
				parent: {
					id: '3',
					firstName: 'mary',
				},
			},
		})

		// make sure we updated user 2
		expect(user2.fields).toEqual({
			id: '2',
			firstName: 'jane-prime',
		})
		expect(user2.linkedRecord('parent').fields).toEqual({
			id: '3',
			firstName: 'mary',
		})
	})

	test('linked lists', function () {
		// instantiate the cache
		const cache = new Cache()

		// add some data to the cache
		cache.write(responseInfo, {
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
		})

		// make sure we can get the linked lists back
		const friendData = cache
			.get(cache.id('User', { id: '1' }))
			.linkedList('friends')
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
		cache.write(responseInfo, {
			viewer: {
				id: '1',
				firstName: 'bob',
				favoriteColors: ['red', 'green', 'blue'],
			},
		})

		// look up the value
		expect(
			cache.get(cache.id('User', { id: '1' })).fields['favoriteColors(where: "foo")']
		).toEqual(['red', 'green', 'blue'])
	})
})
