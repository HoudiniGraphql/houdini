import { testConfig, testConfigFile } from '../../common'
import { RequestContext } from './network'
import { marshalSelection, unmarshalSelection } from './scalars'
import { ArtifactKind, QueryArtifact } from './types'
import { jest } from '@jest/globals'
import type { Page } from '@sveltejs/kit'

jest.mock('./cache', function () {
	return
})

// a mock request context
const ctx = new RequestContext({
	// @ts-ignore
	page: {} as any,
	stuff: {},
	session: null,
	fetch: ((() => {}) as unknown) as (input: RequestInfo, init?: RequestInit) => Promise<any>,
})

const config = testConfigFile({
	schema: `
		scalar DateTime

		input NestedDate {
			name: String
			date: DateTime!
			dates: [DateTime]
			nested: NestedDate!
		}

		type TodoItem {
			text: String!
			createdAt: DateTime!
			dates: [DateTime]
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
	kind: ArtifactKind.Query,
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
				dates: {
					type: 'DateTime',
					keyRaw: 'dates',
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

					list: {
						name: 'All_Items',
						type: 'User',
						connection: false,
					},
				},
			},

			list: {
				name: 'All_Items',
				type: 'User',
				connection: false,
			},
		},
	},
	rootType: 'Query',
	input: {
		fields: {
			date: 'NestedDate',
			booleanValue: 'Boolean',
			enumValue: 'EnumValue',
		},
		types: {
			NestedDate: {
				date: 'DateTime',
				dates: 'DateTime',
				nested: 'NestedDate',
				enumValue: 'EnumValue',
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
			framework: 'kit',
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
									enumValue: 'asdf',
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
							enumValue: 'asdf',
						},
					},
				},
			],
		})
	})

	test('list of scalars', function () {
		// some dates to check against
		const date1 = new Date(0)
		const date2 = new Date(1)

		// compute the inputs
		const inputs = ctx.computeInput({
			config,
			framework: 'kit',
			artifact,
			variableFunction() {
				return {
					date: [
						{
							dates: [date1, date2],
						},
					],
				}
			},
		})

		// make sure we got the expected value
		expect(inputs).toEqual({
			date: [
				{
					dates: [date1.getTime(), date2.getTime()],
				},
			],
		})
	})

	test('empty list of scalars', function () {
		// compute the inputs
		const inputs = ctx.computeInput({
			config,
			framework: 'kit',
			artifact,
			variableFunction() {
				return {
					date: [
						{
							dates: [],
						},
					],
				}
			},
		})

		// make sure we got the expected value
		expect(inputs).toEqual({
			date: [
				{
					dates: [],
				},
			],
		})
	})

	test('root fields', function () {
		// compute the inputs
		const inputs = ctx.computeInput({
			config,
			framework: 'kit',
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
			framework: 'kit',
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
			framework: 'kit',
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
			framework: 'kit',
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
			framework: 'kit',
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

	test('enums', function () {
		// compute the inputs
		const inputs = ctx.computeInput({
			config,
			framework: 'kit',
			artifact,
			variableFunction() {
				return {
					enumValue: 'ValueA',
				}
			},
		})

		// make sure we got the expected value
		expect(inputs).toEqual({
			enumValue: 'ValueA',
		})
	})

	test('list of enums', function () {
		// compute the inputs
		const inputs = ctx.computeInput({
			config,
			framework: 'kit',
			artifact,
			variableFunction() {
				return {
					enumValue: ['ValueA', 'ValueB'],
				}
			},
		})

		// make sure we got the expected value
		expect(inputs).toEqual({
			enumValue: ['ValueA', 'ValueB'],
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

	test('list of scalars', function () {
		// the date to compare against
		const date1 = new Date(1)
		const date2 = new Date(2)

		const data = {
			items: [
				{
					dates: [date1.getTime(), date2.getTime()],
				},
			],
		}

		expect(unmarshalSelection(config, artifact.selection, data)).toEqual({
			items: [
				{
					dates: [date1, date2],
				},
			],
		})
	})

	test('empty list of scalars', function () {
		const data = {
			items: [
				{
					dates: [],
				},
			],
		}

		expect(unmarshalSelection(config, artifact.selection, data)).toEqual({
			items: [
				{
					dates: [],
				},
			],
		})
	})

	test('missing unmarshal function', function () {
		const data = {
			items: [
				{
					dates: [new Date()],
				},
			],
		}

		const badConfig = {
			...config,
			scalars: {
				...config.scalars,
				DateTime: {
					...config.scalars!.DateTime,
					unmarshal: undefined,
				},
			},
		}

		// @ts-ignore
		expect(() => unmarshalSelection(badConfig, artifact.selection, data)).toThrow(
			/scalar type DateTime is missing an `unmarshal` function/
		)
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

						list: {
							name: 'All_Items',
							type: 'User',
							connection: false,
						},
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

	test('enums', function () {
		const data = {
			enumValue: 'Hello',
		}

		const selection = {
			enumValue: {
				type: 'EnumValue',
				keyRaw: 'enumValue',
			},
		}

		expect(unmarshalSelection(config, selection, data)).toEqual({
			enumValue: 'Hello',
		})
	})

	test('list of enums', function () {
		const data = {
			enumValue: ['Hello', 'World'],
		}

		const selection = {
			enumValue: {
				type: 'EnumValue',
				keyRaw: 'enumValue',
			},
		}

		expect(unmarshalSelection(config, selection, data)).toEqual({
			enumValue: ['Hello', 'World'],
		})
	})
})

describe('marshal selection', function () {
	test('list of objects', function () {
		// the date to compare against
		const date = new Date()

		const data = {
			items: [
				{
					createdAt: date,
					creator: {
						firstName: 'John',
					},
				},
			],
		}

		expect(
			marshalSelection({
				config,
				selection: artifact.selection,
				data,
			})
		).toEqual({
			items: [
				{
					createdAt: date.getTime(),
					creator: {
						firstName: 'John',
					},
				},
			],
		})
	})

	test('list of scalars', function () {
		// the date to compare against
		const date1 = new Date(1)
		const date2 = new Date(2)

		const data = {
			items: [
				{
					dates: [date1, date2],
				},
			],
		}

		expect(
			marshalSelection({
				config,
				selection: artifact.selection,
				data,
			})
		).toEqual({
			items: [
				{
					dates: [date1.getTime(), date2.getTime()],
				},
			],
		})
	})

	test('empty list of scalars', function () {
		const data = {
			items: [
				{
					dates: [],
				},
			],
		}

		expect(
			marshalSelection({
				config,
				selection: artifact.selection,
				data,
			})
		).toEqual({
			items: [
				{
					dates: [],
				},
			],
		})
	})

	test('missing marshal function', function () {
		const data = {
			items: [
				{
					dates: [new Date()],
				},
			],
		}

		const badConfig = {
			...config,
			scalars: {
				...config.scalars,
				DateTime: {
					...config.scalars!.DateTime,
					marshal: undefined,
				},
			},
		}

		// @ts-ignore
		expect(() =>
			marshalSelection({
				// @ts-ignore
				config: badConfig,
				selection: artifact.selection,
				data,
			})
		).toThrow(/scalar type DateTime is missing a `marshal` function/)
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

		expect(
			marshalSelection({
				config,
				selection,
				data,
			})
		).toEqual({
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

		expect(
			marshalSelection({
				config,
				selection,
				data,
			})
		).toEqual({
			item: null,
		})
	})

	test('nested objects', function () {
		// the date to compare against
		const date = new Date()

		const data = {
			item: {
				createdAt: date,
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

						list: {
							name: 'All_Items',
							type: 'User',
							connection: false,
						},
					},
				},
			},
		}

		expect(
			marshalSelection({
				config,
				selection,
				data,
			})
		).toEqual({
			item: {
				createdAt: date.getTime(),
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

		expect(
			marshalSelection({
				config,
				selection,
				data,
			})
		).toEqual({
			rootBool: true,
		})
	})

	test('enums', function () {
		const data = {
			enumValue: 'Hello',
		}

		const selection = {
			enumValue: {
				type: 'EnumValue',
				keyRaw: 'enumValue',
			},
		}

		expect(
			marshalSelection({
				config,
				selection,
				data,
			})
		).toEqual({
			enumValue: 'Hello',
		})
	})

	test('list of enums', function () {
		const data = {
			enumValue: ['Hello', 'World'],
		}

		const selection = {
			enumValue: {
				type: 'EnumValue',
				keyRaw: 'enumValue',
			},
		}

		expect(
			marshalSelection({
				config,
				selection,
				data,
			})
		).toEqual({
			enumValue: ['Hello', 'World'],
		})
	})
})
