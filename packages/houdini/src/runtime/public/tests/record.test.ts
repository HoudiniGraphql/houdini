import { test, expect } from 'vitest'

import { ArtifactKind, type FragmentArtifact, type SubscriptionSelection } from '../../lib'
import { testCache, testFragment } from './test'

test('can read fragment', function () {
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

	// write the data as a deeply nested object
	cache._internal_unstable.write({
		selection,
		data: {
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
		},
	})

	// look up the values we just wrote
	expect(
		cache
			.get('User', { id: '1' })
			.read({ fragment: testFragment(selection.fields.viewer.selection) })
	).toEqual({
		partial: false,
		data: {
			id: '1',
			firstName: 'bob',
			__typename: 'User',
			parent: {
				id: '2',
				firstName: 'jane',
				__typename: 'User',
			},
		},
	})
})

test('can writeFragments', function () {
	const cache = testCache()

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

	// write the data as a deeply nested object
	cache._internal_unstable.write({
		selection,
		data: {
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
		},
	})

	const artifact: FragmentArtifact = {
		kind: ArtifactKind.Fragment,
		name: 'string',
		raw: 'string',
		hash: 'string',
		rootType: 'string',
		selection: {
			fields: {
				firstName: {
					type: 'String',
					keyRaw: 'firstName',
				},
			},
		},
	}

	// write a fragment to update User:2
	cache.get('User', { id: '2' }).write({
		fragment: {
			artifact,
		},
		data: {
			firstName: 'michael',
		},
	})

	// make sure we updated the field
	expect(
		cache.get('User', { id: '2' }).read({ fragment: testFragment(artifact.selection) })
	).toEqual({
		partial: false,
		data: {
			firstName: 'michael',
		},
	})
})

test('can read and write variables', function () {
	const cache = testCache()

	const artifact: FragmentArtifact = {
		kind: ArtifactKind.Fragment,
		name: 'string',
		raw: 'string',
		hash: 'string',
		rootType: 'string',
		selection: {
			fields: {
				firstName: {
					type: 'String',
					keyRaw: 'firstName(pattern: $pattern)',
				},
			},
		},
	}

	// write a fragment to update User:2
	cache.get('User', { id: '2' }).write({
		fragment: {
			artifact,
		},
		data: {
			firstName: 'michael',
		},
		variables: {
			pattern: 'foo',
		},
	})

	// make sure we cached the right value for the key
	expect(
		cache._internal_unstable.read({
			parent: 'User:2',
			selection: {
				fields: {
					firstName: {
						keyRaw: 'firstName(pattern: "foo")',
						type: 'String',
					},
				},
			},
		}).data
	).toEqual({ firstName: 'michael' })

	// read from the cache with variables too
	expect(
		cache.get('User', { id: '2' }).read({
			fragment: {
				artifact,
			},
			variables: {
				pattern: 'foo',
			},
		}).data
	).toEqual({ firstName: 'michael' })
})
