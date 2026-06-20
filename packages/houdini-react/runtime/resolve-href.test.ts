import { describe, test, expect } from 'vitest'
import { resolveHref, serializeSearch } from './resolve-href.js'

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
})
