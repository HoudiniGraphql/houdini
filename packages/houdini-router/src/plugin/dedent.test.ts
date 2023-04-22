import { test, describe, expect } from 'vitest'

import { dedent } from './dedent'

const testCases = [
	{
		description: 'Single line',
		input: dedent('Hello, World!'),
		expected: 'Hello, World!',
	},
	{
		description: 'Multiline with different indentation',
		input: dedent(`
      Hello,
        World!`),
		expected: 'Hello,\n  World!',
	},
	{
		description: 'No indentation',
		input: dedent('Hello,\nWorld!'),
		expected: 'Hello,\nWorld!',
	},
	{
		description: 'Extra indentation',
		input: dedent(`
        Hello,
          World!`),
		expected: 'Hello,\n  World!',
	},
	{
		description: 'Empty input',
		input: dedent(''),
		expected: '',
	},
	{
		description: 'Whitespace only',
		input: dedent('  \n\t  \n'),
		expected: '',
	},
	{
		description: 'Tabs and spaces mixed',
		input: dedent(`
      \tHello,
      \t  World!`),
		expected: 'Hello,\n  World!',
	},
	{
		description: 'Additional indent',
		input: dedent(
			'  ',
			`
      Hello,
        World!`
		),
		expected: '  Hello,\n    World!',
	},
	{
		description: 'Additional indent with no initial indent',
		input: dedent('    ', 'Hello,\nWorld!'),
		expected: '    Hello,\n    World!',
	},
	{
		description: 'Preserve empty lines',
		input: dedent(`
      Hello,

        World!`),
		expected: 'Hello,\n\n  World!',
	},
	{
		description: 'Preserve empty lines with additional indent',
		input: dedent(
			'  ',
			`
      Hello,

        World!`
		),
		expected: '  Hello,\n\n    World!',
	},
]

describe('dedent function', () => {
	testCases.forEach((testCase) => {
		test(testCase.description, () => {
			expect(testCase.input).toBe(testCase.expected)
		})
	})
})
