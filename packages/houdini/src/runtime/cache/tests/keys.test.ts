import { test, expect, describe } from 'vitest'

import { evaluateKey } from '../stuff.js'

describe('key evaluation', () => {
	const table = [
		{
			title: 'string',
			key: 'fieldName',
			expected: 'fieldName',
		},
		{
			title: 'variable',
			key: 'fieldName(foo: $bar)',
			variables: { bar: 'baz' },
			expected: 'fieldName(foo: "baz")',
		},
		{
			title: '$ in string',
			key: 'fieldName(foo: "$bar")',
			variables: { bar: 'baz' },
			expected: 'fieldName(foo: "$bar")',
		},
		{
			title: 'undefined variable',
			key: 'fieldName(foo: $bar)',
			expected: 'fieldName(foo: undefined)',
		},
	]

	for (const row of table) {
		test(row.title, () => {
			expect(evaluateKey(row.key, row.variables)).toEqual(row.expected)
		})
	}
})
