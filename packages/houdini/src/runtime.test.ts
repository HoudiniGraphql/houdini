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
				},
			},
		}

		// a function to spy on the update
		const set = jest.fn()

		// the current data
		const current = {
			id: 1,
			target: 'hello',
		}
		// the mutation payload
		const payload = {
			mutationName: {
				id: 1,
				field: 'world',
			},
		}

		// apply the patch
		applyPatch(patch, set, current, payload)

		// make sure we got the expected value
		expect(set).toHaveBeenCalledWith({
			id: 1,
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
				},
			},
		}

		// a function to spy on the update
		const set = jest.fn()

		// the current data
		const current = {
			id: 1,
			target: 'hello',
		}
		// the mutation payload
		const payload = {
			mutationName: {
				id: 2,
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
						},
					},
				},
			},
		}

		// a function to spy on the update
		const set = jest.fn()

		// the current data
		const current = {
			id: 1,
			target: 'hello',
		}
		// the mutation payload
		const payload = {
			mutationName: {
				updateUser: {
					id: 1,
					field: 'world',
				},
			},
		}

		// apply the patch
		applyPatch(patch, set, current, payload)

		// make sure we got the expected value
		expect(set).toHaveBeenCalledWith({
			id: 1,
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
				},
			},
		}

		// a function to spy on the update
		const set = jest.fn()

		// the current data
		const current = {
			id: 1,
			target: 'hello',
		}
		// the mutation payload
		const payload = {
			mutationName: [
				{
					id: 1,
					field: 'world',
				},
			],
		}

		// apply the patch
		applyPatch(patch, set, current, payload)

		// make sure we got the expected value
		expect(set).toHaveBeenCalledWith({
			id: 1,
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
				},
			},
		}

		// a function to spy on the update
		const set = jest.fn()

		// the current data
		const current = {
			nested: {
				id: 1,
				target: 'hello',
			},
		}
		// the mutation payload
		const payload = {
			mutationName: {
				id: 1,
				field: 'world',
			},
		}

		// apply the patch
		applyPatch(patch, set, current, payload)

		// make sure we got the expected value
		expect(set).toHaveBeenCalledWith({
			nested: {
				id: 1,
				target: 'world',
			},
		})
	})

	test('put values into lists', function () {
		const patch: Patch = {
			fields: {},
			edges: {
				mutationName: {
					fields: {
						field: [['target']],
					},
					edges: {},
				},
			},
		}

		// a function to spy on the update
		const set = jest.fn()

		// the current data
		const current = [
			{
				id: 1,
				target: 'hello',
			},
		]

		// the mutation payload
		const payload = {
			mutationName: {
				id: 1,
				field: 'world',
			},
		}

		// apply the patch
		applyPatch(patch, set, current, payload)

		// make sure we got the expected value
		expect(set).toHaveBeenCalledWith([
			{
				id: 1,
				target: 'world',
			},
		])
	})
})
