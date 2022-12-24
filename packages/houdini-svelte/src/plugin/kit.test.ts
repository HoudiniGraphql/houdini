import { describe, expect, test } from 'vitest'

import { route_params } from './kit'

describe('route_params', function () {
	const table = [
		{
			title: 'simple',
			test: 'foo/[variable]/bar',
			expected: {
				variable: {
					name: 'variable',
					matcher: undefined,
					optional: false,
				},
			},
		},
		{
			title: 'two-variables',
			test: 'foo/[variable1]/bar/[variable2]',
			expected: {
				variable1: {
					name: 'variable1',
					matcher: undefined,
					optional: false,
				},
				variable2: {
					name: 'variable2',
					matcher: undefined,
					optional: false,
				},
			},
		},
		{
			title: 'optional',
			test: 'foo/[[variable1]]/bar',
			expected: {
				variable1: {
					name: 'variable1',
					matcher: undefined,
					optional: true,
				},
			},
		},
		{
			title: 'matcher with optional',
			test: 'foo/[[variable=foo]]/bar',
			expected: {
				variable: {
					name: 'variable',
					matcher: 'foo',
					optional: true,
				},
			},
		},
		{
			title: 'rest paramter implies optional',
			test: 'foo/[...variable=foo]/bar',
			expected: {
				variable: {
					name: 'variable',
					matcher: 'foo',
					optional: true,
				},
			},
		},
	]

	for (const row of table) {
		test(row.title, function () {
			expect(route_params(row.test)).toEqual(row.expected)
		})
	}
})
