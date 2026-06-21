import { test, expect, describe, vi } from 'vitest'

import { _serverHandler, collect_response_headers } from './server.js'

describe('_serverHandler url handling', () => {
	function handlerFor(onRender: (args: any) => any, requestHandler?: any) {
		return _serverHandler({
			// a fake yoga server whose init() returns our request handler spy, so the
			// graphql-endpoint branch is exercised without a real schema
			schema: requestHandler ? ({} as any) : undefined,
			server: requestHandler ? ({ init: () => requestHandler } as any) : undefined,
			client: { componentCache: {}, registerProxy: vi.fn() } as any,
			production: true,
			manifest: { pages: {} } as any,
			assetPrefix: '',
			graphqlEndpoint: '/_api',
			componentCache: {},
			config_file: {} as any,
			on_render: onRender,
		})
	}

	test('passes the full url (pathname + query string) to on_render', async () => {
		let seen: string | undefined
		const handler = handlerFor((args) => {
			seen = args.url
			return new Response('ok')
		})

		await handler(new Request('http://localhost/search_params?after=1704067200000&tab=x'))

		// the query string must survive so search params reach find_match / initialURL
		expect(seen).toBe('/search_params?after=1704067200000&tab=x')
	})

	test('routes to the graphql endpoint by pathname even with a query string', async () => {
		const requestHandler = vi.fn(() => new Response('gql'))
		const onRender = vi.fn(() => new Response('page'))
		const handler = handlerFor(onRender, requestHandler)

		await handler(new Request('http://localhost/_api?whatever=1'))

		expect(requestHandler).toHaveBeenCalledTimes(1)
		expect(onRender).not.toHaveBeenCalled()
	})
})

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
