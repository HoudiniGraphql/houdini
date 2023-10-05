import { test, expect } from 'vitest'

import { testCache, testQuery } from './helper.test'

test('can read values', function () {
	const cache = testCache()

	const selection = {
		fields: {
			viewer: {
				type: 'User',
				visible: true,
				keyRaw: 'viewer',
				selection: {
					fields: {
						id: {
							type: 'ID',
							visible: true,
							keyRaw: 'id',
						},
						firstName: {
							type: 'String',
							visible: true,
							keyRaw: 'firstName',
						},
						__typename: {
							type: 'String',
							visible: true,
							keyRaw: '__typename',
						},
						parent: {
							type: 'User',
							visible: true,
							keyRaw: 'parent',
							selection: {
								fields: {
									id: {
										type: 'ID',
										visible: true,
										keyRaw: 'id',
									},
									firstName: {
										type: 'String',
										visible: true,
										keyRaw: 'firstName',
									},
									__typename: {
										type: 'String',
										visible: true,
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
		stale: false,
	})
})

test('can write values', function () {
	const cache = testCache()

	const selection = {
		fields: {
			viewer: {
				type: 'User',
				visible: true,
				keyRaw: 'viewer',
				selection: {
					fields: {
						id: {
							type: 'ID',
							visible: true,
							keyRaw: 'id',
						},
						firstName: {
							type: 'String',
							visible: true,
							keyRaw: 'firstName',
						},
						__typename: {
							type: 'String',
							visible: true,
							keyRaw: '__typename',
						},
						parent: {
							type: 'User',
							visible: true,
							keyRaw: 'parent',
							selection: {
								fields: {
									id: {
										type: 'ID',
										visible: true,
										keyRaw: 'id',
									},
									firstName: {
										type: 'String',
										visible: true,
										keyRaw: 'firstName',
									},
									__typename: {
										type: 'String',
										visible: true,
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
	cache.write({
		query: testQuery(selection),
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
		stale: false,
	})
})

test('can read and write variables', function () {
	const cache = testCache()

	const selection = {
		fields: {
			viewer: {
				type: 'User',
				visible: true,
				keyRaw: 'viewer',
				selection: {
					fields: {
						id: {
							type: 'ID',
							visible: true,
							keyRaw: 'id',
						},
						firstName: {
							type: 'String',
							visible: true,
							keyRaw: 'firstName(pattern: $pattern)',
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
		},
	}

	// write the data as a deeply nested object
	cache.write({
		query: testQuery(selection),
		// @ts-expect-error
		data,
		variables: {
			pattern: 'foo',
		},
	})

	// make sure we cached the right value for the key
	expect(
		cache._internal_unstable.read({
			selection,
			variables: {
				pattern: 'foo',
			},
		}).data
	).toEqual(data)

	// read the value using the document api
	expect(
		cache.read({
			query: testQuery(selection),
			variables: {
				pattern: 'foo',
			},
		})
	).toEqual({
		data,
		partial: false,
		stale: false,
	})
})
