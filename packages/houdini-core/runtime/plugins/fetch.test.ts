import { testConfigFile } from 'houdini/test'
import { beforeEach, expect, test, vi } from 'vitest'

import { setMockConfig } from '../config'
import { fetch as fetchPlugin } from './fetch.js'
import { createStore } from './test.js'

beforeEach(async () => {
	setMockConfig(testConfigFile())
})

function fakeResponse({
	body,
	status = 200,
	contentType = 'application/graphql-response+json',
	statusText = '',
}: {
	body: any
	status?: number
	contentType?: string | null
	statusText?: string
}) {
	return vi.fn(async () => {
		return new Response(typeof body === 'string' ? body : JSON.stringify(body), {
			status,
			statusText,
			headers: contentType ? { 'Content-Type': contentType } : {},
		})
	})
}

test('sends a spec-compliant GraphQL-over-HTTP request', async () => {
	const fetchMock = fakeResponse({ body: { data: { viewer: null } } })
	const store = createStore({ pipeline: [fetchPlugin()] })

	await store.send({ fetch: fetchMock, variables: { id: '1' } })

	expect(fetchMock).toHaveBeenCalledOnce()
	const [url, args] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
	// the client resolves the default local endpoint from config
	expect(String(url).endsWith('/_api')).toBe(true)
	expect(args.method).toEqual('POST')
	expect(args.headers).toMatchObject({
		// the spec requires clients to include application/graphql-response+json
		Accept: 'application/graphql-response+json, application/json;q=0.9',
		'Content-Type': 'application/json',
	})
	expect(JSON.parse(args.body as string)).toEqual({
		operationName: 'TestArtifact',
		query: 'RAW_TEXT',
		variables: { id: '1' },
	})
})

test('sends the x-houdini-request CSRF marker on same-origin requests', async () => {
	// the marker gates CORS-simple bodies (uploads) on the router's own endpoint
	vi.stubGlobal('location', {
		href: 'http://localhost:5173/',
		origin: 'http://localhost:5173',
	})
	try {
		for (const target of ['/_api', 'http://localhost:5173/_api']) {
			const fetchMock = fakeResponse({ body: { data: { viewer: null } } })
			const store = createStore({ pipeline: [fetchPlugin(target)] })
			await store.send({ fetch: fetchMock })

			const [, args] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
			expect(args.headers).toMatchObject({ 'x-houdini-request': 'true' })
		}
	} finally {
		vi.unstubAllGlobals()
	}
})

test('does not send the x-houdini-request marker to a cross-origin api', async () => {
	// a custom header turns an otherwise-simple request into a preflighted one the
	// remote api's CORS config has no reason to allow (#1738)
	vi.stubGlobal('location', {
		href: 'http://localhost:5173/',
		origin: 'http://localhost:5173',
	})
	try {
		const fetchMock = fakeResponse({ body: { data: { viewer: null } } })
		const store = createStore({
			pipeline: [fetchPlugin('https://api.example.com/graphql')],
		})
		await store.send({ fetch: fetchMock })

		const [, args] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
		expect(args.headers).not.toHaveProperty('x-houdini-request')
	} finally {
		vi.unstubAllGlobals()
	}
})

test('surfaces request errors sent as 4xx with the graphql-response media type', async () => {
	// a spec-compliant server responds to a validation failure with a 422 and the
	// details in the errors list
	const store = createStore({ pipeline: [fetchPlugin()] })
	const result = await store.send({
		fetch: fakeResponse({
			body: { errors: [{ message: 'Cannot query field "foo"' }] },
			status: 422,
			contentType: 'application/graphql-response+json; charset=utf-8',
		}),
	})

	expect(result.errors).toEqual([{ message: 'Cannot query field "foo"' }])
	expect(result.data).toBeUndefined()
})

test('parses partial success responses independent of status code', async () => {
	// the spec recommends the custom 294 status when data and errors are both present
	const store = createStore({ pipeline: [fetchPlugin()] })
	const result = await store.send({
		fetch: fakeResponse({
			body: { data: { viewer: null }, errors: [{ message: 'field error' }] },
			status: 294,
		}),
	})

	expect(result.data).toEqual({ viewer: null })
	expect(result.errors).toEqual([{ message: 'field error' }])
})

test('parses application/json responses from legacy servers', async () => {
	const store = createStore({ pipeline: [fetchPlugin()] })
	const result = await store.send({
		fetch: fakeResponse({
			body: { data: { viewer: { id: '1' } } },
			contentType: 'application/json',
		}),
	})

	expect(result.data).toEqual({ viewer: { id: '1' } })
})

test('parses responses using the withdrawn pre-spec media type', async () => {
	const store = createStore({ pipeline: [fetchPlugin()] })
	const result = await store.send({
		fetch: fakeResponse({
			body: { errors: [{ message: 'bad request' }] },
			status: 400,
			contentType: 'application/graphql+json',
		}),
	})

	expect(result.errors).toEqual([{ message: 'bad request' }])
})

test('does not read response headers on successful responses', async () => {
	// SvelteKit's SSR fetch throws when a response header outside
	// filterSerializedResponseHeaders is read, so the happy path must never touch them
	const store = createStore({ pipeline: [fetchPlugin()] })
	const result = await store.send({
		fetch: vi.fn(async () => {
			const response = new Response(JSON.stringify({ data: { viewer: null } }))
			return new Proxy(response, {
				get(target, prop) {
					if (prop === 'headers') {
						throw new Error(
							'Failed to get response header — it must be included by the `filterSerializedResponseHeaders` option'
						)
					}
					const value = Reflect.get(target, prop)
					return typeof value === 'function' ? value.bind(target) : value
				},
			})
		}),
	})

	expect(result.data).toEqual({ viewer: null })
})

test('throws on JSON error responses that are not GraphQL responses', async () => {
	// an intermediary (a rate limiter, a gateway) can send a JSON body that parses fine
	// but has no data or errors entry to surface
	const store = createStore({ pipeline: [fetchPlugin()] })
	await expect(
		store.send({
			fetch: fakeResponse({
				body: { message: 'rate limited' },
				status: 429,
				statusText: 'Too Many Requests',
				contentType: 'application/json',
			}),
		})
	).rejects.toThrow('Failed to fetch: server returned invalid response with error 429')
})

test('throws a useful error when the response body is not valid JSON', async () => {
	const store = createStore({ pipeline: [fetchPlugin()] })
	await expect(
		store.send({
			fetch: fakeResponse({
				body: '<html>not json</html>',
				contentType: 'application/json',
			}),
		})
	).rejects.toThrow('Failed to fetch: server returned a malformed response with status 200')
})

test('throws on error responses that are not GraphQL media types', async () => {
	const store = createStore({ pipeline: [fetchPlugin()] })
	await expect(
		store.send({
			fetch: fakeResponse({
				body: '<html>Service Unavailable</html>',
				status: 503,
				statusText: 'Service Unavailable',
				contentType: 'text/html',
			}),
		})
	).rejects.toThrow('Failed to fetch: server returned invalid response with error 503')
})
