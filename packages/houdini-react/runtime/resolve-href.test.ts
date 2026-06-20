import { describe, test, expect } from 'vitest'
import { buildHref, resolveHref, scalarMarshalers, serializeSearch } from './resolve-href.js'

describe('resolveHref', () => {
	test('substitutes a regular param', () => {
		expect(resolveHref('/users/[id]', { id: '42' })).toBe('/users/42')
	})

	test('substitutes multiple params', () => {
		expect(resolveHref('/users/[id]/posts/[postId]', { id: '1', postId: '99' })).toBe(
			'/users/1/posts/99'
		)
	})

	test('converts number and boolean params to strings', () => {
		expect(resolveHref('/page/[n]', { n: 3 })).toBe('/page/3')
		expect(resolveHref('/flag/[v]', { v: true })).toBe('/flag/true')
	})

	test('includes optional [[param]] segment when value is provided', () => {
		expect(resolveHref('/blog/[[slug]]', { slug: 'hello' })).toBe('/blog/hello')
	})

	test('omits optional [[param]] segment when value is absent', () => {
		expect(resolveHref('/blog/[[slug]]', {})).toBe('/blog')
	})

	test('substitutes rest [...slug] param', () => {
		expect(resolveHref('/docs/[...path]', { path: 'a/b/c' })).toBe('/docs/a/b/c')
	})

	test('omits rest [...slug] when value is absent', () => {
		expect(resolveHref('/docs/[...path]', {})).toBe('/docs/')
	})

	test('handles mixed required, optional, and rest params', () => {
		expect(
			resolveHref('/[lang]/docs/[[version]]/[...path]', { lang: 'en', path: 'guide' })
		).toBe('/en/docs/guide')
		expect(
			resolveHref('/[lang]/docs/[[version]]/[...path]', {
				lang: 'en',
				version: 'v2',
				path: 'guide',
			})
		).toBe('/en/docs/v2/guide')
	})

	test('static href passes through unchanged', () => {
		expect(resolveHref('/about', {})).toBe('/about')
	})
})

describe('serializeSearch', () => {
	test('returns an empty string when nothing is set', () => {
		expect(serializeSearch({})).toBe('')
		expect(serializeSearch({ q: null, sort: undefined })).toBe('')
	})

	test('serializes scalar values with a leading "?"', () => {
		expect(serializeSearch({ q: 'hello' })).toBe('?q=hello')
		expect(serializeSearch({ first: 10, active: true })).toBe('?first=10&active=true')
	})

	test('skips null and undefined values', () => {
		expect(serializeSearch({ q: 'x', sort: null, dir: undefined })).toBe('?q=x')
	})

	test('expands arrays into repeated keys', () => {
		expect(serializeSearch({ tags: ['a', 'b'] })).toBe('?tags=a&tags=b')
	})

	test('a single-element array still serializes as one key', () => {
		expect(serializeSearch({ tags: ['a'] })).toBe('?tags=a')
	})

	test('skips null/undefined entries inside arrays', () => {
		expect(serializeSearch({ tags: ['a', null, undefined, 'b'] })).toBe('?tags=a&tags=b')
	})

	test('encodes reserved characters', () => {
		expect(serializeSearch({ q: 'a b&c' })).toBe('?q=a+b%26c')
	})

	test('marshals a custom-scalar value into its transport form', () => {
		const when = new Date('2024-01-01T00:00:00.000Z')
		const marshalers = { when: (d: Date) => d.getTime() }
		expect(serializeSearch({ when }, marshalers)).toBe(`?when=${when.getTime()}`)
	})

	test('marshals each entry of a list-valued custom scalar', () => {
		const a = new Date('2024-01-01T00:00:00.000Z')
		const b = new Date('2024-02-01T00:00:00.000Z')
		const marshalers = { on: (d: Date) => d.getTime() }
		expect(serializeSearch({ on: [a, b] }, marshalers)).toBe(`?on=${a.getTime()}&on=${b.getTime()}`)
	})
})

describe('scalarMarshalers', () => {
	const scalars = {
		DateTime: { marshal: (d: Date) => d.getTime() },
		// a scalar configured without a marshal function
		Plain: {},
	}

	test('maps a param name to the marshal fn of its custom scalar', () => {
		const m = scalarMarshalers([{ name: 'when', type: 'DateTime' }], scalars)
		expect(typeof m.when).toBe('function')
		expect(m.when(new Date('2024-01-01T00:00:00.000Z'))).toBe(1704067200000)
	})

	test('omits names whose type has no marshal (built-ins, unconfigured scalars)', () => {
		const m = scalarMarshalers(
			[
				{ name: 'page', type: 'Int' },
				{ name: 'tag', type: 'Plain' },
			],
			scalars
		)
		expect(m).toEqual({})
	})

	test('tolerates missing defs and missing scalars', () => {
		expect(scalarMarshalers(undefined, scalars)).toEqual({})
		expect(scalarMarshalers([{ name: 'x', type: 'DateTime' }], undefined)).toEqual({})
	})
})

describe('buildHref', () => {
	const scalars = { DateTime: { marshal: (d: Date) => d.getTime() } }

	test('fills path params and appends search', () => {
		const route = { params: [{ name: 'id', type: 'ID' }], searchParams: [{ name: 'q', type: 'String' }] }
		expect(buildHref('/users/[id]', route, scalars, { id: '1' }, { q: 'hi' })).toBe('/users/1?q=hi')
	})

	test('marshals custom scalars in both params and search', () => {
		const when = new Date('2024-01-01T00:00:00.000Z')
		const route = {
			params: [{ name: 'day', type: 'DateTime' }],
			searchParams: [{ name: 'until', type: 'DateTime' }],
		}
		expect(buildHref('/cal/[day]', route, scalars, { day: when }, { until: when })).toBe(
			`/cal/${when.getTime()}?until=${when.getTime()}`
		)
	})

	test('an external href with no route info is returned untouched', () => {
		expect(buildHref('https://example.com', undefined, scalars)).toBe('https://example.com')
	})
})
