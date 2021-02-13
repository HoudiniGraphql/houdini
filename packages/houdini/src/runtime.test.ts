// externals
import { Patch } from 'houdini-compiler'
// locals
import { applyPatch } from './runtime'

describe('apply patch', function () {
	test('base case', function () {
		const patch: Patch = {
			fields: {},
			edges: {
				mutationName: {
					fields: {
						field: [['target']],
					},
					edges: {},
					operations: {
						add: [],
					},
				},
			},
			operations: {
				add: [],
			},
		}

		// a function to spy on the update
		const set = jest.fn()

		// the current data
		const current = {
			id: '1',
			target: 'hello',
		}
		// the mutation payload
		const payload = {
			mutationName: {
				id: '1',
				field: 'world',
			},
		}

		// apply the patch
		applyPatch(patch, set, current, payload)

		// make sure we got the expected value
		expect(set).toHaveBeenCalledWith({
			id: '1',
			target: 'world',
		})
	})

	test("no update if id doesn't match", function () {
		const patch: Patch = {
			fields: {},
			edges: {
				mutationName: {
					fields: {
						field: [['target']],
					},
					edges: {},
					operations: {
						add: [],
					},
				},
			},
			operations: {
				add: [],
			},
		}

		// a function to spy on the update
		const set = jest.fn()

		// the current data
		const current = {
			id: '1',
			target: 'hello',
		}
		// the mutation payload
		const payload = {
			mutationName: {
				id: '2',
				field: 'world',
			},
		}

		// apply the patch
		applyPatch(patch, set, current, payload)

		// make sure we got the expected value
		expect(set).not.toHaveBeenCalled()
	})

	test('pull values out of objects', function () {
		const patch: Patch = {
			fields: {},
			edges: {
				mutationName: {
					fields: {},
					edges: {
						updateUser: {
							fields: {
								field: [['target']],
							},
							edges: {},
							operations: {
								add: [],
							},
						},
					},
					operations: {
						add: [],
					},
				},
			},
			operations: {
				add: [],
			},
		}

		// a function to spy on the update
		const set = jest.fn()

		// the current data
		const current = {
			id: '1',
			target: 'hello',
		}
		// the mutation payload
		const payload = {
			mutationName: {
				updateUser: {
					id: '1',
					field: 'world',
				},
			},
		}

		// apply the patch
		applyPatch(patch, set, current, payload)

		// make sure we got the expected value
		expect(set).toHaveBeenCalledWith({
			id: '1',
			target: 'world',
		})
	})

	test('pull values out of lists', function () {
		const patch: Patch = {
			fields: {},
			edges: {
				mutationName: {
					fields: {
						field: [['target']],
					},
					edges: {},
					operations: {
						add: [],
					},
				},
			},
			operations: {
				add: [],
			},
		}

		// a function to spy on the update
		const set = jest.fn()

		// the current data
		const current = {
			id: '1',
			target: 'hello',
		}
		// the mutation payload
		const payload = {
			mutationName: [
				{
					id: '1',
					field: 'world',
				},
			],
		}

		// apply the patch
		applyPatch(patch, set, current, payload)

		// make sure we got the expected value
		expect(set).toHaveBeenCalledWith({
			id: '1',
			target: 'world',
		})
	})

	test('put values into objects', function () {
		const patch: Patch = {
			fields: {},
			edges: {
				mutationName: {
					fields: {
						field: [['nested', 'target']],
					},
					edges: {},
					operations: {
						add: [],
					},
				},
			},
			operations: {
				add: [],
			},
		}

		// a function to spy on the update
		const set = jest.fn()

		// the current data
		const current = {
			nested: {
				id: '1',
				target: 'hello',
			},
		}
		// the mutation payload
		const payload = {
			mutationName: {
				id: '1',
				field: 'world',
			},
		}

		// apply the patch
		applyPatch(patch, set, current, payload)

		// make sure we got the expected value
		expect(set).toHaveBeenCalledWith({
			nested: {
				id: '1',
				target: 'world',
			},
		})
	})

	test('add to root connection', function () {
		const patch: Patch = {
			fields: {},
			edges: {
				mutationName: {
					edges: {},
					fields: {},
					operations: {
						add: [
							{
								path: ['outer', 'inner'],
								parentID: {
									kind: 'Root',
									value: 'root',
								},
							},
						],
					},
				},
			},
			operations: {
				add: [],
			},
		}

		// a function to spy on the update
		const set = jest.fn()

		// the current data
		const current = {
			outer: {
				id: '1',
				target: 'hello',
			},
		}

		// the mutation payload
		const payload = {
			mutationName: {
				id: '2',
				target: 'world',
			},
		}

		// apply the patch
		applyPatch(patch, set, current, payload)

		// make sure we got the expected value
		expect(set).toHaveBeenCalledWith({
			outer: {
				id: '1',
				target: 'hello',
				inner: [
					{
						id: '2',
						target: 'world',
					},
				],
			},
		})
	})

	test('add to connection with specific ID', function () {
		const patch: Patch = {
			fields: {},
			edges: {
				mutationName: {
					edges: {},
					fields: {},
					operations: {
						add: [
							{
								path: ['outer', 'inner'],
								parentID: {
									kind: 'String',
									value: '1',
								},
							},
						],
					},
				},
			},
			operations: {
				add: [],
			},
		}

		// a function to spy on the update
		const set = jest.fn()

		// the current data
		const current = {
			outer: [
				{
					id: '1',
					target: 'hello',
				},
			],
		}

		// the mutation payload
		const payload = {
			mutationName: {
				id: '2',
				target: 'world',
			},
		}

		// apply the patch
		applyPatch(patch, set, current, payload)

		// make sure we got the expected value
		expect(set).toHaveBeenCalledWith({
			outer: [
				{
					id: '1',
					target: 'hello',
					inner: [
						{
							id: '2',
							target: 'world',
						},
					],
				},
			],
		})
	})

	test('put values into lists', function () {
		const patch: Patch = {
			fields: {},
			edges: {
				mutationName: {
					fields: {
						field: [['field', 'target']],
					},
					edges: {},
					operations: {
						add: [],
					},
				},
			},
			operations: {
				add: [],
			},
		}

		// a function to spy on the update
		const set = jest.fn()

		// the current data
		const current = {
			field: [
				{
					id: '1',
					target: 'hello',
				},
			],
		}

		// the mutation payload
		const payload = {
			mutationName: {
				id: '1',
				field: 'world',
			},
		}

		// apply the patch
		applyPatch(patch, set, current, payload)

		// make sure we got the expected value
		expect(set).toHaveBeenCalledWith({
			field: [
				{
					id: '1',
					target: 'world',
				},
			],
		})
	})

	test.skip('null values in current state', function () {})
})
