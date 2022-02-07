// external imports
import { testConfig } from 'houdini-common'
// locals
import { Cache } from '../cache'

const config = testConfig()

test('write selection to root', function () {
	// instantiate a cache we'll test against
	const cache = new Cache(config)

	// save the data
	const data = {
		viewer: {
			id: '1',
			firstName: 'bob',
		},
	}
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
			},
		},
	}
	cache.writeSelection({
		selection,
		data,
	})

	// make sure we can get back what we wrote
	expect(
		cache.getSelection({
			selection,
		})
	).toEqual({
		viewer: {
			id: '1',
			firstName: 'bob',
		},
	})
})

test('linked records with updates', function () {
	// instantiate a cache we'll test against
	const cache = new Cache(config)

	// a deeply nested selection link users to other useres
	const deeplyNestedSelection = {
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
	}

	// the field selection we will use to verify updates
	const userFields = {
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
			},
		},
	}

	// write the data as a deeply nested object
	cache.writeSelection({
		selection: deeplyNestedSelection,
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
	expect(cache.getSelection({ selection: userFields, parent: 'User:1' })).toEqual({
		id: '1',
		firstName: 'bob',
		parent: {
			id: '2',
		},
	})

	// check user 2
	expect(cache.getSelection({ selection: userFields, parent: 'User:2' })).toEqual({
		id: '2',
		firstName: 'jane',
		parent: null,
	})

	// associate user2 with a new parent
	cache.writeSelection({
		selection: deeplyNestedSelection,
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
	expect(cache.getSelection({ selection: userFields, parent: 'User:2' })).toEqual({
		id: '2',
		firstName: 'jane-prime',
		parent: {
			id: '3',
		},
	})
	expect(cache.getSelection({ selection: userFields, parent: 'User:3' })).toEqual({
		id: '3',
		firstName: 'mary',
		parent: null,
	})
})

test('linked lists', function () {
	// instantiate the cache
	const cache = new Cache(config)

	// the selection we will read and write
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
	cache.writeSelection({
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
	expect(cache.getSelection({ selection: selection.viewer.fields, parent: 'User:1' })).toEqual({
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
	})
})

test.todo('can write to and resolve layers')

test.todo("resolving a layer with the same value as the most recent doesn't notify subscribers")
