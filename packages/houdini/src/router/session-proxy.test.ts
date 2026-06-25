import { test, expect, describe, vi, afterEach } from 'vitest'

import { _serverHandler } from './server.js'
import { get_session, session_cookie_name } from './session.js'

// These cover the REMOTE-api @session path: with no local schema the server can't mint inline, so
// the client routes a @session mutation to `${authUrl}/proxy`, which forwards it to the upstream
// `apiEndpoint` and writes the session cookie from the result. The proxy reuses the same hardened
// chain as the relay (Origin CSRF, body limit, sign→verify→sid→single-use→write); these tests pin
// the proxy-specific guarantees: it forwards, it sets the cookie, it doesn't leak our cookie
// upstream, and it never writes a session on a bad Origin / oversize body / GraphQL error.

const KEY = 'proxy-test-secret'
const UPSTREAM = 'http://upstream.test/graphql'
const PROXY_URL = 'http://localhost/_auth/proxy'

afterEach(() => {
	vi.unstubAllGlobals()
})

// build a handler with NO local schema (so the proxy is mounted) and a Login @session mutation
function proxyHandler(server_config: Record<string, any> = { auth: { sessionKeys: [KEY] } }) {
	return _serverHandler({
		schema: null,
		client: { componentCache: {}, registerProxy: vi.fn() } as any,
		production: true,
		manifest: {
			pages: {},
			pagesByUrl: {},
			formActions: {},
			sessionMutations: { Login: { sessionPath: 'login.session' } },
		} as any,
		assetPrefix: '',
		graphqlEndpoint: UPSTREAM,
		componentCache: {},
		config_file: {} as any,
		server_config: { apiEndpoint: UPSTREAM, ...server_config } as any,
		on_render: () => new Response('page'),
	})
}

// a fetch stub standing in for the upstream graphql api
function stubUpstream(body: any, init?: ResponseInit) {
	const mock = vi.fn(async () => new Response(JSON.stringify(body), init))
	vi.stubGlobal('fetch', mock)
	return mock
}

// mirror the client: the operation name rides in the x-houdini-operation header, not the body
function proxyPOST(body: Record<string, any>, headers: Record<string, string> = {}) {
	return new Request(PROXY_URL, {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			origin: 'http://localhost',
			...(body.operationName ? { 'x-houdini-operation': body.operationName } : {}),
			...headers,
		},
		body: JSON.stringify(body),
	})
}

// read the session the proxy wrote back out of the response's Set-Cookie
async function sessionFromResponse(res: Response): Promise<App.Session> {
	const setCookie = res.headers.get('set-cookie') ?? ''
	const value = setCookie.slice(setCookie.indexOf('=') + 1, setCookie.indexOf(';'))
	const headers = new Headers({ cookie: `${session_cookie_name}=${value}` })
	return get_session(headers, [KEY])
}

describe('@session proxy (remote api, no local schema)', () => {
	test('forwards to the upstream api and writes the session cookie from the result', async () => {
		const upstream = stubUpstream({ data: { login: { session: { token: 'abc' } } } })
		const res = await proxyHandler()(
			proxyPOST({ operationName: 'Login', query: 'mutation Login {...}', variables: {} })
		)

		// forwarded to the configured upstream
		expect(upstream).toHaveBeenCalledTimes(1)
		expect(upstream.mock.calls[0][0]).toBe(UPSTREAM)

		// the cookie was written server-authoritatively from the upstream result
		expect(res.headers.get('set-cookie')).toContain(session_cookie_name)
		expect(await sessionFromResponse(res)).toEqual({ token: 'abc' })

		// the client is told the cookie was set (so useSession mirrors without relaying)
		const payload = await res.json()
		expect(payload.data.login.session.token).toBe('abc')
		expect(payload.extensions.houdiniSessionApplied).toBe(true)
	})

	test('does NOT forward the Houdini session cookie to the upstream api', async () => {
		const upstream = stubUpstream({ data: { login: { session: { token: 'abc' } } } })
		await proxyHandler()(
			proxyPOST(
				{ operationName: 'Login', query: 'mutation Login {...}', variables: {} },
				{ cookie: `${session_cookie_name}=leak; other=keep`, authorization: 'Bearer xyz' }
			)
		)
		const forwardedHeaders = upstream.mock.calls[0][1].headers as Headers
		// our session cookie must be stripped...
		expect(forwardedHeaders.get('cookie')).toBe(null)
		// ...as is our internal routing hint...
		expect(forwardedHeaders.get('x-houdini-operation')).toBe(null)
		// ...but the user's own auth header still reaches their api
		expect(forwardedHeaders.get('authorization')).toBe('Bearer xyz')
	})

	test('establishes the session for a multipart (file upload) @session mutation', async () => {
		const upstream = stubUpstream({ data: { login: { session: { token: 'multi' } } } })
		// a multipart body the proxy must forward as-is; the operation name comes from the header, so
		// the proxy never parses the body and the session is still written.
		const form = new FormData()
		form.set('operations', JSON.stringify({ operationName: 'Login', query: 'mutation Login {...}' }))
		form.set('map', '{}')
		const res = await proxyHandler()(
			new Request(PROXY_URL, {
				method: 'POST',
				headers: { origin: 'http://localhost', 'x-houdini-operation': 'Login' },
				body: form,
			})
		)
		expect(upstream).toHaveBeenCalledTimes(1)
		expect(res.headers.get('set-cookie')).toContain(session_cookie_name)
		expect(await sessionFromResponse(res)).toEqual({ token: 'multi' })
	})

	test('rejects a cross-origin request (CSRF) without forwarding', async () => {
		const upstream = stubUpstream({ data: { login: { session: { token: 'abc' } } } })
		const res = await proxyHandler()(
			proxyPOST(
				{ operationName: 'Login', query: 'mutation Login {...}', variables: {} },
				{ origin: 'http://evil.com' }
			)
		)
		expect(res.status).toBe(403)
		expect(upstream).not.toHaveBeenCalled()
	})

	test('rejects an over-large body (413) without forwarding', async () => {
		const upstream = stubUpstream({ data: { login: { session: { token: 'abc' } } } })
		const res = await proxyHandler({ auth: { sessionKeys: [KEY] }, formMaxBodyBytes: 8 })(
			proxyPOST({ operationName: 'Login', query: 'mutation Login { a very long body }', variables: {} })
		)
		expect(res.status).toBe(413)
		expect(upstream).not.toHaveBeenCalled()
	})

	test('does not write the session when the mutation returns GraphQL errors', async () => {
		stubUpstream({ errors: [{ message: 'nope' }] })
		const res = await proxyHandler()(
			proxyPOST({ operationName: 'Login', query: 'mutation Login {...}', variables: {} })
		)
		// the error result is relayed, but no cookie and no applied flag
		expect(res.headers.get('set-cookie')).toBe(null)
		const payload = await res.json()
		expect(payload.errors).toHaveLength(1)
		expect(payload.extensions?.houdiniSessionApplied).toBeUndefined()
	})

	test('a non-@session mutation is forwarded but never writes a session', async () => {
		stubUpstream({ data: { somethingElse: { id: '1' } } })
		const res = await proxyHandler()(
			proxyPOST({ operationName: 'SomethingElse', query: 'mutation SomethingElse {...}', variables: {} })
		)
		expect(res.headers.get('set-cookie')).toBe(null)
		const payload = await res.json()
		expect(payload.data.somethingElse.id).toBe('1')
		expect(payload.extensions?.houdiniSessionApplied).toBeUndefined()
	})
})
