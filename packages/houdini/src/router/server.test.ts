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

describe('_serverHandler form submissions', () => {
	const baseArtifact = {
		name: 'CreateUser',
		kind: 'HoudiniMutation',
		raw: 'mutation CreateUser($name: String!) { createUser(name: $name) { id } }',
		input: { fields: { name: 'String' }, types: {}, defaults: {}, runtimeScalars: {} },
		endpoint: { redirect: ['/users/', ['createUser', 'id']] },
	}

	function formHandlerFor(opts: {
		graphqlResult: any
		onRender?: (args: any) => any
		artifact?: any
		config?: any
	}) {
		const artifact = opts.artifact ?? baseArtifact
		const requestHandler = vi.fn(async () => new Response(JSON.stringify(opts.graphqlResult)))
		return _serverHandler({
			schema: {} as any,
			server: { init: () => requestHandler } as any,
			client: { componentCache: {}, registerProxy: vi.fn() } as any,
			production: true,
			manifest: {
				pages: {},
				pagesByUrl: {},
				formActions: { CreateUser: () => Promise.resolve({ default: artifact }) },
			} as any,
			assetPrefix: '',
			graphqlEndpoint: '/_api',
			componentCache: {},
			config_file: (opts.config ?? { router: {} }) as any,
			on_render: opts.onRender ?? (() => new Response('page')),
		})
	}

	function formRequest(
		body: Record<string, string>,
		headers: Record<string, string> = { origin: 'http://localhost' }
	) {
		return new Request('http://localhost/users/new', {
			method: 'POST',
			headers: { 'content-type': 'application/x-www-form-urlencoded', ...headers },
			body: new URLSearchParams(body),
		})
	}

	test('rejects a form POST with a missing Origin (CSRF, fail-closed)', async () => {
		const handler = formHandlerFor({ graphqlResult: {} })
		const res = await handler(formRequest({ __houdini_form: 'CreateUser', name: 'A' }, {}))
		expect(res.status).toBe(403)
	})

	test('rejects a form POST from a disallowed Origin', async () => {
		const handler = formHandlerFor({ graphqlResult: {} })
		const res = await handler(
			formRequest({ __houdini_form: 'CreateUser', name: 'A' }, { origin: 'http://evil.com' })
		)
		expect(res.status).toBe(403)
	})

	test('success with a redirect → 303 to the interpolated target', async () => {
		const handler = formHandlerFor({ graphqlResult: { data: { createUser: { id: '7' } } } })
		const res = await handler(formRequest({ __houdini_form: 'CreateUser', name: 'Alice' }))
		expect(res.status).toBe(303)
		expect(res.headers.get('location')).toBe('/users/7')
	})

	test('success without a redirect → 303 back to the page (PRG)', async () => {
		const handler = formHandlerFor({
			graphqlResult: { data: { createUser: { id: '7' } } },
			artifact: { ...baseArtifact, endpoint: {} },
		})
		const res = await handler(formRequest({ __houdini_form: 'CreateUser', name: 'Alice' }))
		expect(res.status).toBe(303)
		expect(res.headers.get('location')).toBe('/users/new')
	})

	test('errors → re-render the page with formResult injected, status 422', async () => {
		let seen: any
		const handler = formHandlerFor({
			graphqlResult: { data: null, errors: [{ message: 'nope' }] },
			onRender: (args) => {
				seen = args
				return new Response('page', { status: 200 })
			},
		})
		const res = await handler(formRequest({ __houdini_form: 'CreateUser', name: 'Alice' }))
		expect(res.status).toBe(422)
		expect(seen.formResult).toEqual({ CreateUser: { data: null, errors: [{ message: 'nope' }] } })
	})

	test('keys formResult by an explicit form id', async () => {
		let seen: any
		const handler = formHandlerFor({
			graphqlResult: { errors: [{ message: 'nope' }] },
			onRender: (args) => {
				seen = args
				return new Response('page')
			},
		})
		await handler(
			formRequest({ __houdini_form: 'CreateUser', __houdini_form_id: 'invite', name: 'A' })
		)
		expect(Object.keys(seen.formResult)).toEqual(['invite'])
	})

	test('unknown form mutation → 400', async () => {
		const handler = formHandlerFor({ graphqlResult: {} })
		const res = await handler(formRequest({ __houdini_form: 'Nope', name: 'A' }))
		expect(res.status).toBe(400)
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
