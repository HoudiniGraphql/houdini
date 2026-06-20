import { test, expect, describe } from 'vitest'

import { exec, find_match, parse_page_pattern } from './match.js'
import type { RouterManifest } from './types.js'

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
			name: 'Parameter with space',
			pattern: '/user/[id]',
			url: '/user/4%202',
			expected: {
				variables: {
					id: '4 2',
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

describe('find_match parse and match', async () => {
	// every test case needs to be an collection of urls and the expected match
	const table = [
		{
			name: 'root match is last',
			urls: ['/foo', '/'],
			expected: '/foo',
		},
	]

	for (const { name, urls, expected } of table) {
		test(name, async () => {
			// build up the list of patterns
			const patterns = urls.map((url) => parse_page_pattern(url))

			// wrap the patterns in a mocked manifest
			const manifest: RouterManifest<any> = {
				pages: patterns.reduce(
					(pages, pattern) => ({
						...pages,
						[pattern.page_id]: {
							id: pattern.page_id,
							pattern: pattern.pattern,
							// the params used to execute the pattern and extract the variables
							params: pattern.params,
							searchParams: [],
						},
					}),
					{}
				),
			}

			// find the match
			const [match] = find_match(manifest, expected)
			expect(match?.id).toEqual(expected)
		})
	}
})

describe('find_match search params', () => {
	function pageFor(
		url: string,
		extra: {
			documents?: RouterManifest<any>['pages'][string]['documents']
			searchParams?: RouterManifest<any>['pages'][string]['searchParams']
		} = {}
	): RouterManifest<any>['pages'][string] {
		const parsed = parse_page_pattern(url)
		return {
			id: url,
			url,
			pattern: parsed.pattern,
			params: parsed.params,
			searchParams: extra.searchParams ?? [],
			documents: extra.documents ?? {},
			component: () => Promise.resolve({ default: (() => null) as any }),
		}
	}

	function match(page: RouterManifest<any>['pages'][string], current: string) {
		const [, variables] = find_match({ pages: { [page.id]: page } }, current)
		return variables
	}

	test('fills a nullable scalar search param', () => {
		const page = pageFor('/search', {
			searchParams: [{ name: 'q', type: 'String', wrappers: [] }],
		})
		expect(match(page, '/search?q=hello')).toEqual({ q: 'hello' })
	})

	test('coerces a search param to its scalar type', () => {
		const page = pageFor('/search', {
			searchParams: [{ name: 'page', type: 'Int', wrappers: [] }],
		})
		expect(match(page, '/search?page=2')).toEqual({ page: 2 })
	})

	test('expands a List search param from repeated keys', () => {
		const page = pageFor('/search', {
			searchParams: [{ name: 'tags', type: 'String', wrappers: ['List', 'NonNull'] }],
		})
		expect(match(page, '/search?tags=a&tags=b')).toEqual({ tags: ['a', 'b'] })
	})

	test('a single value for a List search param stays a one-element array', () => {
		const page = pageFor('/search', {
			searchParams: [{ name: 'tags', type: 'String', wrappers: ['List', 'NonNull'] }],
		})
		expect(match(page, '/search?tags=a')).toEqual({ tags: ['a'] })
	})

	test('leaves an absent search param unset', () => {
		const page = pageFor('/search', {
			searchParams: [{ name: 'q', type: 'String', wrappers: [] }],
		})
		expect(match(page, '/search')).toEqual({})
	})

	test('combines route params and search params', () => {
		const page = pageFor('/user/[id]', {
			documents: { Q: { artifact: null as any, loading: false, variables: { id: { type: 'ID' } } } },
			searchParams: [{ name: 'ref', type: 'String', wrappers: [] }],
		})
		expect(match(page, '/user/42?ref=abc')).toEqual({ id: '42', ref: 'abc' })
	})

	test('a route param wins over a same-named search param', () => {
		const page = pageFor('/user/[id]', {
			searchParams: [{ name: 'id', type: 'String', wrappers: [] }],
		})
		expect(match(page, '/user/42?id=99')).toEqual({ id: '42' })
	})
})
