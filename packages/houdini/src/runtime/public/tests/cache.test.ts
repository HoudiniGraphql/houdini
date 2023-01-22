import { test, expect } from 'vitest'

import { testCache, testQuery } from './test'

test('can read values', function () {
	const cache = testCache()

	const selection = {
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
						__typename: {
							type: 'String',
							keyRaw: '__typename',
						},
						parent: {
							type: 'User',
							keyRaw: 'parent',
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

	const data = {
		viewer: {
			id: '1',
			firstName: 'bob',
			__typename: 'User',
			parent: {
				id: '2',
				firstName: 'jane',
				__typename: 'User',
			},
		},
	}

	// write the data as a deeply nested object
	cache._internal_unstable.write({
		selection,
		data,
	})

	// read the value using the document api
	expect(
		cache.read({
			query: testQuery(selection),
		})
	).toEqual({
		data,
		partial: false,
	})
})
