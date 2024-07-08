import { test, expect, describe, beforeEach } from 'vitest'

import { testConfigFile } from '../../test'
import { defaultConfigValues, setMockConfig } from './config'
import { marshalInputs, marshalSelection, parseScalar } from './scalars'
import type { QueryArtifact, SubscriptionSelection } from './types'
import { ArtifactKind } from './types'

const config = defaultConfigValues({
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

beforeEach(() => setMockConfig(config))

// the test artifact
const artifact: QueryArtifact = {
	name: 'AllItems',
	kind: ArtifactKind.Query,
	hash: 'hash',
	raw: 'does not matter',
	pluginData: {},
	selection: {
		fields: {
			items: {
				type: 'TodoItem',
				keyRaw: 'allItems',

				selection: {
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

							selection: {
								fields: {
									firstName: {
										type: 'String',
										keyRaw: 'firstName',
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
				},

				list: {
					name: 'All_Items',
					type: 'User',
					connection: false,
				},
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
		runtimeScalars: {},
		defaults: {},
	},
}

describe('marshal inputs', function () {
	test('lists of objects', async function () {
		// some dates to check against
		const date1 = new Date(0)
		const date2 = new Date(1)
		const date3 = new Date(2)

		// compute the inputs
		const inputs = marshalInputs({
			artifact,
			config,
			input: {
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

	test('list of scalars', async function () {
		// some dates to check against
		const date1 = new Date(0)
		const date2 = new Date(1)

		// compute the inputs

		const inputs = marshalInputs({
			artifact,
			config,
			input: {
				date: [
					{
						dates: [date1, date2],
					},
				],
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

	test('empty list of scalars', async function () {
		// compute the inputs

		const inputs = marshalInputs({
			artifact,
			config,
			input: {
				date: [
					{
						dates: [],
					},
				],
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

	test('root fields', async function () {
		// compute the inputs

		const inputs = marshalInputs({
			artifact,
			config,
			input: {
				booleanValue: true,
			},
		})

		// make sure we got the expected value
		expect(inputs).toEqual({
			booleanValue: true,
		})
	})

	test('non-custom scalar fields of objects', async function () {
		// compute the inputs

		const inputs = marshalInputs({
			artifact,
			config,
			input: {
				date: {
					name: 'hello',
				},
			},
		})

		// make sure we got the expected value
		expect(inputs).toEqual({
			date: {
				name: 'hello',
			},
		})
	})

	test('non-custom scalar fields of lists', async function () {
		// compute the inputs

		const inputs = marshalInputs({
			artifact,
			config,
			input: {
				date: [
					{
						name: 'hello',
					},
				],
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

	test('null', async function () {
		// compute the inputs

		const inputs = marshalInputs({
			artifact,
			config,
			input: {
				date: null,
			},
		})

		// make sure we got the expected value
		expect(inputs).toEqual({
			date: null,
		})
	})

	test('undefined', async function () {
		// compute the inputs

		const inputs = marshalInputs({
			artifact,
			config,
			input: {
				date: undefined,
			},
		})

		// make sure we got the expected value
		expect(inputs).toEqual({
			date: undefined,
		})
	})

	test('enums', async function () {
		// compute the inputs

		const inputs = marshalInputs({
			artifact,
			config,
			input: {
				enumValue: 'ValueA',
			},
		})

		// make sure we got the expected value
		expect(inputs).toEqual({
			enumValue: 'ValueA',
		})
	})

	test('list of enums', async function () {
		// compute the inputs

		const inputs = marshalInputs({
			artifact,
			config,
			input: {
				enumValue: ['ValueA', 'ValueB'],
			},
		})

		// make sure we got the expected value
		expect(inputs).toEqual({
			enumValue: ['ValueA', 'ValueB'],
		})
	})
})

describe('marshal selection', function () {
	test('list of objects', async function () {
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

		await expect(
			marshalSelection({
				selection: artifact.selection,
				data,
			})
		).resolves.toEqual({
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

	test('list of scalars', async function () {
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

		await expect(
			marshalSelection({
				selection: artifact.selection,
				data,
			})
		).resolves.toEqual({
			items: [
				{
					dates: [date1.getTime(), date2.getTime()],
				},
			],
		})
	})

	test('empty list of scalars', async function () {
		const data = {
			items: [
				{
					dates: [],
				},
			],
		}

		await expect(
			marshalSelection({
				selection: artifact.selection,
				data,
			})
		).resolves.toEqual({
			items: [
				{
					dates: [],
				},
			],
		})
	})

	test('missing marshal function', async function () {
		setMockConfig(
			testConfigFile({
				scalars: {
					DateTime: {
						type: 'Date',
					},
				},
			})
		)

		const data = {
			items: [
				{
					dates: [new Date()],
				},
			],
		}

		await expect(() =>
			marshalSelection({
				selection: artifact.selection,
				data,
			})
		).rejects.toThrow(/Scalar type DateTime is missing a `marshal` function/)
	})

	test('undefined', async function () {
		const data = {
			item: undefined,
		}

		const selection: SubscriptionSelection = {
			fields: {
				item: {
					type: 'TodoItem',
					keyRaw: 'item',

					selection: {
						fields: {
							createdAt: {
								type: 'DateTime',
								keyRaw: 'createdAt',
							},
						},
					},
				},
			},
		}

		await expect(
			marshalSelection({
				selection,
				data,
			})
		).resolves.toEqual({
			item: undefined,
		})
	})

	test('null', async function () {
		const data = {
			item: null,
		}

		const selection: SubscriptionSelection = {
			fields: {
				item: {
					type: 'TodoItem',
					keyRaw: 'item',

					selection: {
						fields: {
							createdAt: {
								type: 'DateTime',
								keyRaw: 'createdAt',
							},
						},
					},
				},
			},
		}

		await expect(
			marshalSelection({
				selection,
				data,
			})
		).resolves.toEqual({
			item: null,
		})
	})

	test('nested objects', async function () {
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

		const selection: SubscriptionSelection = {
			fields: {
				item: {
					type: 'TodoItem',
					keyRaw: 'item',

					selection: {
						fields: {
							createdAt: {
								type: 'DateTime',
								keyRaw: 'createdAt',
							},
							creator: {
								type: 'User',
								keyRaw: 'creator',

								selection: {
									fields: {
										firstName: {
											type: 'String',
											keyRaw: 'firstName',
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
					},
				},
			},
		}

		await expect(
			marshalSelection({
				selection,
				data,
			})
		).resolves.toEqual({
			item: {
				createdAt: date.getTime(),
				creator: {
					firstName: 'John',
				},
			},
		})
	})

	test('fields on root', async function () {
		const data = {
			rootBool: true,
		}

		const selection: SubscriptionSelection = {
			fields: {
				rootBool: {
					type: 'Boolean',
					keyRaw: 'rootBool',
				},
			},
		}

		await expect(
			marshalSelection({
				selection,
				data,
			})
		).resolves.toEqual({
			rootBool: true,
		})
	})

	test('enums', async function () {
		const data = {
			enumValue: 'Hello',
		}

		const selection: SubscriptionSelection = {
			fields: {
				enumValue: {
					type: 'EnumValue',
					keyRaw: 'enumValue',
				},
			},
		}

		await expect(
			marshalSelection({
				selection,
				data,
			})
		).resolves.toEqual({
			enumValue: 'Hello',
		})
	})

	test('list of enums', async function () {
		const data = {
			enumValue: ['Hello', 'World'],
		}

		const selection: SubscriptionSelection = {
			fields: {
				enumValue: {
					type: 'EnumValue',
					keyRaw: 'enumValue',
				},
			},
		}

		await expect(
			marshalSelection({
				selection,
				data,
			})
		).resolves.toEqual({
			enumValue: ['Hello', 'World'],
		})
	})
})

describe('parseScalar', function () {
	const table = [
		{
			title: 'String',
			type: 'String',
			value: 'asf',
			expected: 'asf',
		},
		{
			title: 'ID',
			type: 'ID',
			value: 'asf',
			expected: 'asf',
		},
		{
			title: 'Int',
			type: 'Int',
			value: '1',
			expected: 1,
		},
		{
			title: 'invalid Int',
			type: 'Int',
			value: '',
			expected: undefined,
		},
		{
			title: 'invalid Float',
			type: 'Float',
			value: '',
			expected: undefined,
		},
		{
			title: 'Boolean',
			type: 'Boolean',
			value: 'true',
			expected: true,
		},
		{
			title: 'Float',
			type: 'Float',
			value: '1.0',
			expected: 1.0,
		},
		{
			title: 'Custom with Marshal',
			type: 'MyScalar',
			value: '1.0',
			expected: 100.0,
		},
		{
			title: 'Custom mo Marshal',
			type: 'MyScalar2',
			value: '1.0',
			expected: '1.0',
		},
	]

	const config = testConfigFile({
		scalars: {
			MyScalar: {
				type: 'number',
				marshal(val: string) {
					return parseInt(val, 10) * 100
				},
			},
		},
	})

	for (const row of table) {
		test(row.title, function () {
			expect(parseScalar(config, row.type, row.value)).toEqual(row.expected)
		})
	}
})
