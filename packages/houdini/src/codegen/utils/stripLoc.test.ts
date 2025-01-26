import type * as graphql from 'graphql'
import { expect, test, describe } from 'vitest'

import { stripLoc } from './stripLoc'

describe('stripLoc', function () {
	const table: { name: string; value: graphql.ValueNode; expected: graphql.ValueNode }[] = [
		{
			name: 'Boolean',
			value: {
				kind: 'BooleanValue',
				value: true,
				loc,
			},
			expected: {
				kind: 'BooleanValue',
				value: true,
			},
		},
		{
			name: 'Int',
			value: {
				kind: 'IntValue',
				value: '1',
				loc,
			},
			expected: {
				kind: 'IntValue',
				value: '1',
			},
		},
		{
			name: 'Object',
			value: {
				kind: 'ObjectValue',
				fields: [
					{
						kind: 'ObjectField',
						name: {
							kind: 'Name',
							value: 'a',
							loc,
						},
						loc,
						value: {
							kind: 'IntValue',
							value: '1',
							loc,
						},
					},
				],
				loc,
			},
			expected: {
				kind: 'ObjectValue',
				fields: [
					{
						kind: 'ObjectField',
						name: {
							kind: 'Name',
							value: 'a',
						},
						value: {
							kind: 'IntValue',
							value: '1',
						},
					},
				],
			},
		},
		{
			name: 'List',
			value: {
				kind: 'ListValue',
				loc,
				values: [
					{
						kind: 'ObjectValue',
						fields: [
							{
								kind: 'ObjectField',
								name: {
									kind: 'Name',
									value: 'a',
									loc,
								},
								loc,
								value: {
									kind: 'IntValue',
									value: '1',
									loc,
								},
							},
						],
					},
				],
			},
			expected: {
				kind: 'ListValue',
				values: [
					{
						kind: 'ObjectValue',
						fields: [
							{
								kind: 'ObjectField',
								name: {
									kind: 'Name',
									value: 'a',
								},
								value: {
									kind: 'IntValue',
									value: '1',
								},
							},
						],
					},
				],
			},
		},
	]

	for (const row of table) {
		test(row.name, function () {
			expect(stripLoc(row.value)).toEqual(row.expected)
		})
	}
})

// @ts-ignore
const loc: graphql.Location = {
	start: 0,
	end: 0,
}
