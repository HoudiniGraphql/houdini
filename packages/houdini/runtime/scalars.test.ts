import { testConfig } from 'houdini-common'
import { RequestContext } from './network'
import { unmarshalSelection } from './scalars'
import { QueryArtifact } from './types'

// a mock request context
const ctx = new RequestContext({
	page: { host: '', path: '', params: null, query: null },
	context: null,
	session: null,
	fetch: ((() => {}) as unknown) as (input: RequestInfo, init?: RequestInit) => Promise<any>,
})

const config = testConfig({
	schema: `
		scalar DateTime
		
		input NestedDate { 
			name: String
			date: DateTime!
			nested: NestedDate!
		}

		type TodoItem { 
			text: String!
			createdAt: DateTime! 
			creator: User!
		}	

		type User { 
			firstName: String!
		}

		type Query { 
			items(date: NestedDate, booleanValue: Boolean): [TodoItem!]!
			item: TodoItem
			rootBool: Boolean!
		}
	`,
	scalars: {
		DateTime: {
			type: 'Date',
			unmarshal(val: number): Date {
				return new Date(val)
			},
			marshal(date: Date): number {
				return date.getTime()
			},
		},
	},
})

// the test artifact
const artifact: QueryArtifact = {
	name: 'AllItems',
	kind: 'HoudiniQuery',
	hash: 'hash',
	raw: 'does not matter',
	selection: {
		items: {
			type: 'TodoItem',
			keyRaw: 'allItems',

			fields: {
				createdAt: {
					type: 'DateTime',
					keyRaw: 'createdAt',
				},
				creator: {
					type: 'User',
					keyRaw: 'creator',

					fields: {
						firstName: {
							type: 'String',
							keyRaw: 'firstName',
						},
					},

					list: 'All_Items',
				},
			},

			list: 'All_Items',
		},
	},
	rootType: 'Query',
	input: {
		fields: {
			date: 'NestedDate',
			booleanValue: 'Boolean',
		},
		types: {
			NestedDate: {
				date: 'DateTime',
				nested: 'NestedDate',
			},
		},
	},
}

describe('marshal inputs', function () {
	test('lists of objects', function () {
		// some dates to check against
		const date1 = new Date(0)
		const date2 = new Date(1)
		const date3 = new Date(2)

		// compute the inputs
		const inputs = ctx.computeInput({
			config,
			mode: 'kit',
			artifact,
			variableFunction() {
				return {
					date: [
						{
							date: date1,
							nested: {
								date: date2,
								nested: {
									date: date3,
								},
							},
						},
					],
				}
			},
		})

		// make sure we got the expected value
		expect(inputs).toEqual({
			date: [
				{
					date: date1.getTime(),
					nested: {
						date: date2.getTime(),
						nested: {
							date: date3.getTime(),
						},
					},
				},
			],
		})
	})

	test('root fields', function () {
		// compute the inputs
		const inputs = ctx.computeInput({
			config,
			mode: 'kit',
			artifact,
			variableFunction() {
				return {
					booleanValue: true,
				}
			},
		})

		// make sure we got the expected value
		expect(inputs).toEqual({
			booleanValue: true,
		})
	})

	test('non-custom scalar fields of objects', function () {
		// compute the inputs
		const inputs = ctx.computeInput({
			config,
			mode: 'kit',
			artifact,
			variableFunction() {
				return {
					date: {
						name: 'hello',
					},
				}
			},
		})

		// make sure we got the expected value
		expect(inputs).toEqual({
			date: {
				name: 'hello',
			},
		})
	})

	test('non-custom scalar fields of lists', function () {
		// compute the inputs
		const inputs = ctx.computeInput({
			config,
			mode: 'kit',
			artifact,
			variableFunction() {
				return {
					date: [
						{
							name: 'hello',
						},
					],
				}
			},
		})

		// make sure we got the expected value
		expect(inputs).toEqual({
			date: [
				{
					name: 'hello',
				},
			],
		})
	})

	test('null', function () {
		// compute the inputs
		const inputs = ctx.computeInput({
			config,
			mode: 'kit',
			artifact,
			variableFunction() {
				return {
					date: null,
				}
			},
		})

		// make sure we got the expected value
		expect(inputs).toEqual({
			date: null,
		})
	})

	test('undefined', function () {
		// compute the inputs
		const inputs = ctx.computeInput({
			config,
			mode: 'kit',
			artifact,
			variableFunction() {
				return {
					date: undefined,
				}
			},
		})

		// make sure we got the expected value
		expect(inputs).toEqual({
			date: undefined,
		})
	})
})

describe('unmarshal selection', function () {
	test('list of objects', function () {
		// the date to compare against
		const date = new Date()

		const data = {
			items: [
				{
					createdAt: date.getTime(),
					creator: {
						firstName: 'John',
					},
				},
			],
		}

		expect(unmarshalSelection(config, artifact.selection, data)).toEqual({
			items: [
				{
					createdAt: date,
					creator: {
						firstName: 'John',
					},
				},
			],
		})
	})

	test('undefined', function () {
		const data = {
			item: undefined,
		}

		const selection = {
			item: {
				type: 'TodoItem',
				keyRaw: 'item',

				fields: {
					createdAt: {
						type: 'DateTime',
						keyRaw: 'createdAt',
					},
				},
			},
		}

		expect(unmarshalSelection(config, selection, data)).toEqual({
			item: undefined,
		})
	})

	test('null', function () {
		const data = {
			item: null,
		}

		const selection = {
			item: {
				type: 'TodoItem',
				keyRaw: 'item',

				fields: {
					createdAt: {
						type: 'DateTime',
						keyRaw: 'createdAt',
					},
				},
			},
		}

		expect(unmarshalSelection(config, selection, data)).toEqual({
			item: null,
		})
	})

	test('nested objects', function () {
		// the date to compare against
		const date = new Date()

		const data = {
			item: {
				createdAt: date.getTime(),
				creator: {
					firstName: 'John',
				},
			},
		}

		const selection = {
			item: {
				type: 'TodoItem',
				keyRaw: 'item',

				fields: {
					createdAt: {
						type: 'DateTime',
						keyRaw: 'createdAt',
					},
					creator: {
						type: 'User',
						keyRaw: 'creator',

						fields: {
							firstName: {
								type: 'String',
								keyRaw: 'firstName',
							},
						},

						list: 'All_Items',
					},
				},
			},
		}

		expect(unmarshalSelection(config, selection, data)).toEqual({
			item: {
				createdAt: date,
				creator: {
					firstName: 'John',
				},
			},
		})
	})

	test('fields on root', function () {
		const data = {
			rootBool: true,
		}

		const selection = {
			rootBool: {
				type: 'Boolean',
				keyRaw: 'rootBool',
			},
		}

		expect(unmarshalSelection(config, selection, data)).toEqual({
			rootBool: true,
		})
	})
})
