import { evaluateKey } from '../cache'

describe('key evaluation', function () {
	const table = [
		{
			title: 'string',
			key: 'fieldName',
			variables: {},
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
			variables: {},
			expected: 'fieldName(foo: undefined)',
		},
	]

	for (const row of table) {
		test(row.title, function () {
			expect(evaluateKey(row.key, row.variables)).toEqual(row.expected)
		})
	}
})
