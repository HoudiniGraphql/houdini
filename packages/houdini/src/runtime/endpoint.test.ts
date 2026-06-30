import { test, expect, describe } from 'vitest'

import { interpolateRedirect } from './endpoint.js'

describe('interpolateRedirect', () => {
	test('joins literals with interpolated, url-encoded path values', () => {
		expect(
			interpolateRedirect(['/users/', ['createUser', 'id']], { createUser: { id: '7' } })
		).toBe('/users/7')
	})

	test('url-encodes interpolated segments', () => {
		expect(interpolateRedirect(['/u/', ['user', 'name']], { user: { name: 'a b/c' } })).toBe(
			'/u/a%20b%2Fc'
		)
	})

	test('a static template has no interpolation', () => {
		expect(interpolateRedirect(['/dashboard'], {})).toBe('/dashboard')
	})

	test('returns null when an interpolation path resolves to null/undefined', () => {
		expect(interpolateRedirect(['/users/', ['createUser', 'id']], { createUser: null })).toBe(
			null
		)
		expect(interpolateRedirect(['/users/', ['createUser', 'id']], { createUser: {} })).toBe(
			null
		)
	})
})
