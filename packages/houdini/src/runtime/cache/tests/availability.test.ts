import { test, expect, vi } from 'vitest'

import { testConfigFile } from '../../../test'
import { Cache } from '../cache'

const config = testConfigFile()

test('not partial', function () {
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
					},
				},
			},
		},
	}

	// make sure we can't resolve it already
	expect(cache.read({ selection })).toMatchObject({
		data: null,
		partial: false,
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
						id: '2',
						firstName: 'jane',
					},
					null,
				],
			},
		},
	})

	// make sure we can't resolve it already
	expect(cache.read({ selection })).toMatchObject({
		partial: false,
	})
})

test('not partial with empty list', function () {
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

	// make sure we can't resolve it already
	expect(cache.read({ selection })).toMatchObject({
		data: null,
		partial: false,
	})

	// add some data to the cache
	cache.write({
		selection,
		data: {
			viewer: {
				id: '1',
				firstName: 'bob',
				friends: [],
			},
		},
	})

	// make sure we get the right partial status
	expect(cache.read({ selection })).toMatchObject({
		partial: false,
	})
})

test('partial with missing linked record', function () {
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

	// make sure we can't resolve it already
	expect(cache.read({ selection })).toMatchObject({
		data: null,
		partial: false,
	})

	// add some data to the cache
	cache.write({
		selection,
		data: {
			viewer: {
				id: '1',
				firstName: 'bob',
			},
		},
	})

	// make sure we get the right partial status
	expect(cache.read({ selection })).toMatchObject({
		partial: true,
	})
})

test('partial with missing single field', function () {
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
				friends: [],
			},
		},
	})

	expect(cache.read({ selection })).toMatchObject({
		partial: true,
	})
})

test('partial missing data inside of linked list', function () {
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

	// add some data to the cache with an incomplete set of values for an element
	// inside of a list
	cache.write({
		selection,
		data: {
			viewer: {
				id: '1',
				friends: [{ id: '2', firstName: 'anthony' }, { id: '3' }],
			},
		},
	})

	expect(cache.read({ selection })).toMatchObject({
		partial: true,
	})
})

test('missing cursor of item in connection from operation should not trigger null cascade', function () {
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
				friends: {
					type: 'User',
					keyRaw: 'friends',
					list: {
						name: 'All_Users',
						connection: true,
						type: 'User',
					},
					fields: {
						edges: {
							type: 'UserEdge',
							keyRaw: 'edges',
							fields: {
								cursor: {
									type: 'Node',
									keyRaw: 'cursor',
									nullable: false,
								},
								node: {
									type: 'Node',
									keyRaw: 'node',
									abstract: true,
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
	}

	// add some elements to the list already
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

	cache.subscribe({
		set: vi.fn(),
		selection,
		rootType: 'Query',
	})

	// add some data to the cache with an incomplete set of values for an element
	// inside of a list
	cache.list('All_Users').prepend(
		{
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
		{
			__typename: 'User',
			id: '2',
			firstName: 'Sally',
		}
	)

	expect(cache.read({ selection })).not.toMatchObject({
		data: {
			viewer: {
				friends: {
					edges: expect.arrayContaining([null]),
				},
			},
		},
	})
})
