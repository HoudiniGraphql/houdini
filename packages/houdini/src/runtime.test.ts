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
				},
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
		applyPatch(patch, set, current, payload, {})

		// make sure we got the expected value
		expect(set).toHaveBeenCalledWith(
			{
				id: '1',
				target: 'world',
			},
			{}
		)
	})

	test("no update if id doesn't match", function () {
		const patch: Patch = {
			fields: {},
			edges: {
				mutationName: {
					fields: {
						field: [['target']],
					},
				},
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
		applyPatch(patch, set, current, payload, {})

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
						},
					},
				},
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
		applyPatch(patch, set, current, payload, {})

		// make sure we got the expected value
		expect(set).toHaveBeenCalledWith(
			{
				id: '1',
				target: 'world',
			},
			{}
		)
	})

	test('pull values out of lists', function () {
		const patch: Patch = {
			fields: {},
			edges: {
				mutationName: {
					fields: {
						field: [['target']],
					},
				},
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
		applyPatch(patch, set, current, payload, {})

		// make sure we got the expected value
		expect(set).toHaveBeenCalledWith(
			{
				id: '1',
				target: 'world',
			},
			{}
		)
	})

	test('put values into objects', function () {
		const patch: Patch = {
			fields: {},
			edges: {
				mutationName: {
					fields: {
						field: [['nested', 'target']],
					},
				},
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
		applyPatch(patch, set, current, payload, {})

		// make sure we got the expected value
		expect(set).toHaveBeenCalledWith(
			{
				nested: {
					id: '1',
					target: 'world',
				},
			},
			{}
		)
	})

	test('add to root lists', function () {
		const patch: Patch = {
			fields: {},
			edges: {
				mutationName: {
					edges: {},
					fields: {},
					operations: {
						add: [
							{
								path: ['outer'],
								position: 'end',
								parentID: {
									kind: 'Root',
									value: 'root',
								},
							},
						],
					},
				},
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
		applyPatch(patch, set, current, payload, {})

		// make sure we got the expected value
		expect(set).toHaveBeenCalledWith(
			{
				outer: [
					{
						id: '1',
						target: 'hello',
					},
					{
						id: '2',
						target: 'world',
					},
				],
			},
			{}
		)
	})

	test('add to connection under root', function () {
		const patch: Patch = {
			fields: {},
			edges: {
				mutationName: {
					edges: {},
					fields: {},
					operations: {
						add: [
							{
								path: ['outer'],
								position: 'end',
								parentID: {
									kind: 'Root',
									value: 'root',
								},
							},
						],
					},
				},
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
		applyPatch(patch, set, current, payload, {})

		// make sure we got the expected value
		expect(set).toHaveBeenCalledWith(
			{
				outer: [
					{
						id: '1',
						target: 'hello',
					},
					{
						id: '2',
						target: 'world',
					},
				],
			},
			{}
		)
	})

	test('prepend connection', function () {
		const patch: Patch = {
			fields: {},
			edges: {
				mutationName: {
					edges: {},
					fields: {},
					operations: {
						add: [
							{
								path: ['outer'],
								position: 'start',
								parentID: {
									kind: 'Root',
									value: 'root',
								},
							},
						],
					},
				},
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
		applyPatch(patch, set, current, payload, {})

		// make sure we got the expected value
		expect(set).toHaveBeenCalledWith(
			{
				outer: [
					{
						id: '2',
						target: 'world',
					},
					{
						id: '1',
						target: 'hello',
					},
				],
			},
			{}
		)
	})

	test('remove from connection with literal ID', function () {
		const patch: Patch = {
			fields: {},
			edges: {
				mutationName: {
					edges: {},
					fields: {},
					operations: {
						remove: [
							{
								path: ['outer', 'inner'],
								position: 'end',
								parentID: {
									kind: 'String',
									value: '1',
								},
							},
						],
					},
				},
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
					inner: [
						{
							id: '2',
							target: 'hello',
						},
					],
				},
			],
		}

		// the mutation payload
		const payload = {
			mutationName: {
				id: '2',
			},
		}

		// apply the patch
		applyPatch(patch, set, current, payload, {})

		// make sure we got the expected value
		expect(set).toHaveBeenCalledWith(
			{
				outer: [
					{
						id: '1',
						target: 'hello',
						inner: [],
					},
				],
			},
			{}
		)
	})

	test('delete from multiple connections with literal id', function () {
		const patch: Patch = {
			fields: {},
			edges: {
				mutationName: {
					edges: {
						targetId: {
							operations: {
								delete: [
									{
										path: ['outer', 'inner'],
										position: 'end',
										parentID: {
											kind: 'String',
											value: '1',
										},
									},
								],
							},
						},
					},
					fields: {},
				},
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
					inner: [
						{
							id: '2',
							target: 'hello',
						},
					],
				},
				{
					id: '3',
					target: 'hello',
					inner: [
						{
							id: '2',
							target: 'hello',
						},
					],
				},
			],
		}

		// the mutation payload
		const payload = {
			mutationName: {
				targetId: '2',
			},
		}

		// apply the patch
		applyPatch(patch, set, current, payload, {})

		// make sure we got the expected value
		expect(set).toHaveBeenCalledWith(
			{
				outer: [
					{
						id: '1',
						target: 'hello',
						inner: [],
					},
					{
						id: '3',
						target: 'hello',
						inner: [],
					},
				],
			},
			{}
		)
	})

	test('delete from root connection with literal id', function () {
		const patch: Patch = {
			fields: {},
			edges: {
				mutationName: {
					edges: {
						targetId: {
							operations: {
								delete: [
									{
										path: ['outer'],
										position: 'end',
										parentID: {
											kind: 'String',
											value: '1',
										},
									},
								],
							},
						},
					},
					fields: {},
				},
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
				{
					id: '2',
					target: 'hello',
				},
			],
		}

		// the mutation payload
		const payload = {
			mutationName: {
				targetId: '2',
			},
		}

		// apply the patch
		applyPatch(patch, set, current, payload, {})

		// make sure we got the expected value
		expect(set).toHaveBeenCalledWith(
			{
				outer: [
					{
						id: '1',
						target: 'hello',
					},
				],
			},
			{}
		)
	})

	test('add to connection with literal ID', function () {
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
								position: 'end',
								parentID: {
									kind: 'String',
									value: '1',
								},
							},
						],
					},
				},
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
		applyPatch(patch, set, current, payload, {})

		// make sure we got the expected value
		expect(set).toHaveBeenCalledWith(
			{
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
			},
			{}
		)
	})

	test('add to connection with variable ID', function () {
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
								position: 'end',
								parentID: {
									kind: 'Variable',
									value: 'testID',
								},
							},
						],
					},
				},
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
		applyPatch(patch, set, current, payload, { testID: '1' })

		// make sure we got the expected value
		expect(set).toHaveBeenCalledWith(
			{
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
			},
			{ testID: '1' }
		)
	})

	test('apply connection when  negative', function () {
		const patch: Patch = {
			fields: {},
			edges: {
				mutationName: {
					edges: {},
					fields: {},
					operations: {
						add: [
							{
								path: ['outer'],
								position: 'end',
								parentID: {
									kind: 'Root',
									value: 'root',
								},
								when: {
									target: 'not-value',
								},
								connectionName: "Test"
							},
						],
					},
				},
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
			__connectionFilters: {
				Test: {
					stringKey: "StringValue",
				}
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
		applyPatch(patch, set, current, payload, {})

		// make sure we got the expected value
		expect(set).not.toHaveBeenCalled()
	})

	test('put values into lists', function () {
		const patch: Patch = {
			fields: {},
			edges: {
				mutationName: {
					fields: {
						field: [['field', 'target']],
					},
				},
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
		applyPatch(patch, set, current, payload, {})

		// make sure we got the expected value
		expect(set).toHaveBeenCalledWith(
			{
				field: [
					{
						id: '1',
						target: 'world',
					},
				],
			},
			{}
		)
	})

	test.todo('null values in current state')
})
