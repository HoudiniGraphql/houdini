import { test, expect, describe } from 'vitest'

import type { GraphQLObject, ValueMap } from '../../lib/types'
import { evaluateFragmentVariables } from '../cache'

describe('evaluateFragmentVariables', function () {
	const table: { title: string; input: ValueMap; variables: GraphQLObject; expected: any }[] = [
		{
			title: 'String',
			input: {
				value: {
					kind: 'StringValue',
					value: 'Hello',
				},
			},
			variables: {},
			expected: { value: 'Hello' },
		},
		{
			title: 'Boolean',
			input: {
				value: {
					kind: 'BooleanValue',
					value: true,
				},
			},
			variables: {},
			expected: { value: true },
		},
		{
			title: 'Float',
			input: {
				value: {
					kind: 'FloatValue',
					value: '1.2',
				},
			},
			variables: {},
			expected: { value: 1.2 },
		},
		{
			title: 'Int',
			input: {
				value: {
					kind: 'IntValue',
					value: '1',
				},
			},
			variables: {},
			expected: { value: 1 },
		},
		{
			title: 'null',
			input: {
				value: {
					kind: 'NullValue',
				},
			},
			variables: {},
			expected: { value: null },
		},
		{
			title: 'Variable',
			input: {
				value: {
					kind: 'Variable',
					name: {
						kind: 'Name',
						value: 'foo',
					},
				},
			},
			variables: {
				foo: 'bar',
			},
			expected: { value: 'bar' },
		},
		{
			title: 'List',
			input: {
				value: {
					kind: 'ListValue',
					values: [
						{
							kind: 'BooleanValue',
							value: true,
						},
					],
				},
			},
			variables: {
				foo: 'bar',
			},
			expected: { value: [true] },
		},
		{
			title: 'Object',
			input: {
				value: {
					kind: 'ObjectValue',
					fields: [
						{
							kind: 'ObjectField',
							name: {
								kind: 'Name',
								value: 'foo',
							},
							value: {
								kind: 'BooleanValue',
								value: true,
							},
						},
					],
				},
			},
			variables: {
				foo: 'bar',
			},
			expected: { value: { foo: true } },
		},
	]

	for (const row of table) {
		test(row.title, function () {
			expect(evaluateFragmentVariables(row.input, row.variables)).toEqual(row.expected)
		})
	}
})
