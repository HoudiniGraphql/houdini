import { describe, test, expect } from 'vitest'
import { resolveHref } from './resolve-href.js'

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
		expect(resolveHref('/[lang]/docs/[[version]]/[...path]', { lang: 'en', path: 'guide' })).toBe(
			'/en/docs/guide'
		)
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
