import { test, expect, describe } from 'vitest'

import { collect_response_headers } from './server.js'

describe('collect_response_headers', () => {
	test('returns an empty object when there are no headers loaders', async () => {
		expect(await collect_response_headers(null)).toEqual({})
		expect(await collect_response_headers({})).toEqual({})
		expect(await collect_response_headers({ headers: [] })).toEqual({})
	})

	test('merges every loaded headers() result', async () => {
		const headers = [
			() => Promise.resolve(() => ({ 'X-Layout': 'outer', 'X-From': 'layout' })),
			() => Promise.resolve(() => ({ 'X-Page': 'page' })),
		]

		expect(await collect_response_headers({ headers })).toEqual({
			'X-Layout': 'outer',
			'X-From': 'layout',
			'X-Page': 'page',
		})
	})

	test('later loaders win so the page overrides its layouts', async () => {
		const headers = [
			() => Promise.resolve(() => ({ 'X-From': 'outer-layout' })),
			() => Promise.resolve(() => ({ 'X-From': 'inner-layout' })),
			() => Promise.resolve(() => ({ 'X-From': 'page' })),
		]

		expect(await collect_response_headers({ headers })).toEqual({
			'X-From': 'page',
		})
	})

	test('awaits async headers() functions and coerces values to strings', async () => {
		const headers = [
			() => Promise.resolve(async () => ({ 'Cache-Control': 'public', 'X-Count': 1 as any })),
		]

		expect(await collect_response_headers({ headers })).toEqual({
			'Cache-Control': 'public',
			'X-Count': '1',
		})
	})

	test('skips loaders whose module does not export a headers function', async () => {
		const headers = [
			() => Promise.resolve(undefined),
			() => Promise.resolve(() => ({ 'X-From': 'page' })),
		]

		expect(await collect_response_headers({ headers })).toEqual({
			'X-From': 'page',
		})
	})
})
