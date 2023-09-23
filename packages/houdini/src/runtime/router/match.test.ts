import { test, expect, describe } from 'vitest'

import { exec, parse_page_pattern } from './match'

describe('route_params', () => {
	const testCases = [
		{
			name: 'Basic route without any parameters',
			pattern: '/home',
			url: '/home',
			expected: {
				variables: {},
				layout: null,
			},
		},
		{
			name: 'Route with a single required parameter',
			pattern: '/user/[id]',
			url: '/user/42',
			expected: {
				variables: {
					id: '42',
				},
				layout: null,
			},
		},
		{
			name: 'Route with a single required parameter (missing)',
			pattern: '/user/[id]',
			url: '/user',
			expected: null,
		},
		{
			name: 'Route with multiple required parameters',
			pattern: '/blog/[category]/[id]',
			url: '/blog/technology/5',
			expected: {
				variables: {
					category: 'technology',
					id: '5',
				},
				layout: null,
			},
		},
		{
			name: 'Route with multiple required parameters (first missing)',
			pattern: '/blog/[category]/[id]',
			url: '/blog/5',
			expected: null,
		},
		{
			name: 'Route with multiple required parameters (second missing)',
			pattern: '/blog/[category]/[id]',
			url: '/blog/technology',
			expected: null,
		},
		{
			name: 'Route with a single optional parameter',
			pattern: '/search/[[query]]',
			url: '/search/ai',
			expected: {
				variables: {
					query: 'ai',
				},
				layout: null,
			},
		},
		{
			name: 'Route with a single optional parameter (omitted)',
			pattern: '/search/[[query]]',
			url: '/search',
			expected: {
				variables: {},
				layout: null,
			},
		},
		{
			name: 'Route with multiple optional chained parameters (first present)',
			pattern: '/lang/[[lang=language]]/[[country=country]]',
			url: '/lang/en',
			expected: {
				variables: {
					lang: 'en',
				},
				layout: null,
			},
		},
	]

	testCases.forEach(({ name, pattern, url, expected }) => {
		test(name, () => {
			// parse the route pattern
			const result = parse_page_pattern(pattern)

			// if we're not expected to match, make sure that's the case
			if (!expected) {
				expect(url).not.toMatch(result.pattern)
				return
			}

			// we are expected to match, so get the variables and make sure they are
			// what we expect
			expect(exec(url.match(result.pattern)!, result.params)).toEqual(expected.variables)
		})
	})
})
