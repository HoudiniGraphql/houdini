import { createSchema } from 'graphql-yoga'
import { test, expect, describe, vi, beforeAll } from 'vitest'

import { _serverHandler, signFormToken } from './server.js'

// the form CSRF token is always on; tests use a known session key so they can mint a valid
// token through the real path (the test requests carry no cookie, so the bound session is
// the empty {} the server also sees)
const TOKEN_KEY = 'test-secret'
let validToken: string
beforeAll(async () => {
	validToken = await signFormToken({}, [TOKEN_KEY])
})

// An end-to-end test of the no-JS form path: a native form POST is run through the real
// Yoga server (real coercion → real GraphQL execution → real redirect interpolation), with
// no browser and no client JS involved. This is the path a form takes before/without
// hydration.

const schema = createSchema({
	typeDefs: /* GraphQL */ `
		type Query {
			hello: String
		}
		type User {
			id: ID!
			name: String!
		}
		scalar File
		scalar Timestamp
		type Mutation {
			createUser(name: String!): User!
			boom: User!
			uploadAvatar(file: File!): User!
			createEvent(at: Timestamp!): User!
		}
	`,
	resolvers: {
		Mutation: {
			createUser: (_: unknown, { name }: { name: string }) => ({ id: '7', name }),
			boom: () => {
				throw new Error('kaboom')
			},
			// name the user after the uploaded file's contents so the test can prove the
			// file actually made it through the multipart request to the resolver
			uploadAvatar: async (_: unknown, { file }: { file: File }) => ({
				id: '9',
				name: await file.text(),
			}),
			// a custom scalar must arrive marshaled (the timestamp number), not a Date's
			// default ISO-string serialization — id reflects which the resolver got
			createEvent: (_: unknown, { at }: { at: unknown }) => ({
				id: typeof at === 'number' ? 'marshaled' : `wrong:${typeof at}`,
				name: 'event',
			}),
		},
	},
})

const createUserArtifact = {
	name: 'CreateUser',
	kind: 'HoudiniMutation',
	raw: 'mutation CreateUser($name: String!) { createUser(name: $name) { id name } }',
	input: { fields: { name: 'String' }, types: {}, defaults: {}, runtimeScalars: {} },
	endpoint: { redirect: ['/users/', ['createUser', 'id']] },
}

const boomArtifact = {
	name: 'Boom',
	kind: 'HoudiniMutation',
	raw: 'mutation Boom { boom { id } }',
	input: { fields: {}, types: {}, defaults: {}, runtimeScalars: {} },
	endpoint: { redirect: ['/users/', ['boom', 'id']] },
}

const uploadArtifact = {
	name: 'UploadAvatar',
	kind: 'HoudiniMutation',
	raw: 'mutation UploadAvatar($file: File!) { uploadAvatar(file: $file) { id } }',
	input: { fields: { file: 'File' }, types: {}, defaults: {}, runtimeScalars: {} },
	endpoint: { redirect: ['/users/', ['uploadAvatar', 'id']] },
}

const eventArtifact = {
	name: 'CreateEvent',
	kind: 'HoudiniMutation',
	raw: 'mutation CreateEvent($at: Timestamp!) { createEvent(at: $at) { id } }',
	input: { fields: { at: 'Timestamp' }, types: {}, defaults: {}, runtimeScalars: {} },
	endpoint: { redirect: ['/events/', ['createEvent', 'id']] },
}

// a config with a custom scalar that marshals a Date to its timestamp (like the e2e app's
// DateTime), so the server path's marshal step is observable
const scalarConfig = {
	router: { auth: { sessionKeys: [TOKEN_KEY] } },
	scalars: {
		Timestamp: {
			type: 'Date',
			marshal: (date: Date) => date.getTime(),
			unmarshal: (value: number) => new Date(value),
		},
	},
}

function serverWith(onRender: (args: any) => any = () => new Response('page')) {
	return _serverHandler({
		// a real schema → _serverHandler builds a real Yoga internally
		schema,
		client: { componentCache: {}, registerProxy: vi.fn() } as any,
		production: true,
		manifest: {
			pages: {},
			pagesByUrl: {},
			formActions: {
				CreateUser: () => Promise.resolve({ default: createUserArtifact as any }),
				Boom: () => Promise.resolve({ default: boomArtifact as any }),
				UploadAvatar: () => Promise.resolve({ default: uploadArtifact as any }),
				CreateEvent: () => Promise.resolve({ default: eventArtifact as any }),
			},
		} as any,
		assetPrefix: '',
		graphqlEndpoint: '/_api',
		componentCache: {},
		config_file: scalarConfig as any,
		on_render: onRender,
	})
}

function formPOST(
	url: string,
	body: Record<string, string>,
	headers: Record<string, string> = { origin: 'http://localhost' }
) {
	// carry a valid CSRF token by default (body can override or omit it)
	return new Request(url, {
		method: 'POST',
		headers: { 'content-type': 'application/x-www-form-urlencoded', ...headers },
		body: new URLSearchParams({ __houdini_csrf: validToken, ...body }),
	})
}

describe('no-JS form submission (real Yoga)', () => {
	test('runs the mutation and 303s to the interpolated redirect', async () => {
		const handler = serverWith()
		const res = await handler(
			formPOST('http://localhost/users/new', { __houdini_form: 'CreateUser', name: 'Alice' })
		)
		// the redirect target comes from the REAL mutation result (createUser.id === "7")
		expect(res.status).toBe(303)
		expect(res.headers.get('location')).toBe('/users/7')
	})

	test('a GraphQL error re-renders the page with the real errors, status 422', async () => {
		let seen: any
		const handler = serverWith((args) => {
			seen = args
			return new Response('page', { status: 200 })
		})
		const res = await handler(formPOST('http://localhost/x', { __houdini_form: 'Boom' }))
		expect(res.status).toBe(422)
		// the real GraphQL errors are threaded through (Yoga masks the message in
		// production, but the error is present and keyed by form id)
		expect(seen.formResult.Boom.errors.length).toBeGreaterThan(0)
	})

	test('a multipart form with a file uploads it through to the mutation', async () => {
		const handler = serverWith()
		const form = new FormData()
		form.set('__houdini_form', 'UploadAvatar')
		form.set('__houdini_csrf', validToken)
		// a native <form enctype="multipart/form-data"> with a file input posts this shape
		form.set('file', new Blob(['avatar-bytes'], { type: 'text/plain' }), 'avatar.txt')
		const res = await handler(
			new Request('http://localhost/x', {
				method: 'POST',
				headers: { origin: 'http://localhost' }, // FormData sets the multipart content-type
				body: form,
			})
		)
		// uploadAvatar(file: File!) succeeding (303, not a 422 non-null error) proves the
		// file survived coercion + the multipart request all the way to the resolver
		expect(res.status).toBe(303)
		expect(res.headers.get('location')).toBe('/users/9')
	})

	test('custom scalars are marshaled to transport form before the mutation runs', async () => {
		const handler = serverWith()
		const res = await handler(
			// the form carries the timestamp as a string, like a hidden input would
			formPOST('http://localhost/x', { __houdini_form: 'CreateEvent', at: '1700000000000' })
		)
		expect(res.status).toBe(303)
		// "/events/marshaled" only happens if the resolver received a number (the marshaled
		// Date); a Date's default JSON serialization (ISO string) would give "/events/wrong:string"
		expect(res.headers.get('location')).toBe('/events/marshaled')
	})

	describe('CSRF token (always on)', () => {
		// the success-path tests above already prove a valid token is accepted (formPOST
		// carries one); here we prove a missing or forged token is rejected.
		test('rejects a form POST without the token', async () => {
			const handler = serverWith()
			const res = await handler(
				new Request('http://localhost/x', {
					method: 'POST',
					headers: {
						'content-type': 'application/x-www-form-urlencoded',
						origin: 'http://localhost',
					},
					body: new URLSearchParams({ __houdini_form: 'CreateUser', name: 'A' }),
				})
			)
			expect(res.status).toBe(403)
		})

		test('rejects a form POST with a forged/invalid token', async () => {
			const handler = serverWith()
			const res = await handler(
				formPOST('http://localhost/x', {
					__houdini_form: 'CreateUser',
					name: 'A',
					__houdini_csrf: 'not.a.valid.token',
				})
			)
			expect(res.status).toBe(403)
		})

		test('rejects a token bound to a different session', async () => {
			// a valid token minted for someone else's session must not work on this request
			// (which carries no cookie ⇒ the empty session)
			const otherToken = await signFormToken({ userId: 'someone-else' } as any, [TOKEN_KEY])
			const res = await serverWith()(
				formPOST('http://localhost/x', {
					__houdini_form: 'CreateUser',
					name: 'A',
					__houdini_csrf: otherToken,
				})
			)
			expect(res.status).toBe(403)
		})
	})

	describe('Origin allowlist', () => {
		// fail-closed/disallowed-origin rejection is unit-tested in server.test.ts; here we
		// prove the other direction end-to-end: an allowlisted cross-origin is admitted and
		// the real mutation runs.
		test('accepts a form POST from an origin in allowedOrigins (303)', async () => {
			const handler = _serverHandler({
				schema,
				client: { componentCache: {}, registerProxy: vi.fn() } as any,
				production: true,
				manifest: {
					pages: {},
					pagesByUrl: {},
					formActions: {
						CreateUser: () => Promise.resolve({ default: createUserArtifact as any }),
					},
				} as any,
				assetPrefix: '',
				graphqlEndpoint: '/_api',
				componentCache: {},
				config_file: {
					router: { auth: { sessionKeys: [TOKEN_KEY] }, allowedOrigins: ['http://trusted.com'] },
				} as any,
				on_render: () => new Response('page'),
			})
			const res = await handler(
				formPOST(
					'http://localhost/users/new',
					{ __houdini_form: 'CreateUser', name: 'Alice' },
					{ origin: 'http://trusted.com' }
				)
			)
			// passes the Origin gate via the allowlist, then the token + mutation run for real
			expect(res.status).toBe(303)
			expect(res.headers.get('location')).toBe('/users/7')
		})
	})

	test('rejects a form body larger than formMaxBodyBytes (413)', async () => {
		// a tiny cap so a normal body trips it; the guard runs before the body is buffered
		const handler = _serverHandler({
			schema,
			client: { componentCache: {}, registerProxy: vi.fn() } as any,
			production: true,
			manifest: {
				pages: {},
				pagesByUrl: {},
				formActions: {
					CreateUser: () => Promise.resolve({ default: createUserArtifact as any }),
				},
			} as any,
			assetPrefix: '',
			graphqlEndpoint: '/_api',
			componentCache: {},
			config_file: { router: { auth: { sessionKeys: [TOKEN_KEY] }, formMaxBodyBytes: 5 } } as any,
			on_render: () => new Response('page'),
		})
		const res = await handler(
			new Request('http://localhost/x', {
				method: 'POST',
				headers: {
					'content-type': 'application/x-www-form-urlencoded',
					origin: 'http://localhost',
					'content-length': '50', // > the 5-byte cap
				},
				body: new URLSearchParams({ __houdini_form: 'CreateUser', name: 'A' }),
			})
		)
		expect(res.status).toBe(413)
	})

	test('a body with no Content-Length bypasses the size guard (host/proxy enforces)', async () => {
		// the guard only trips on a known Content-Length; a streamed/chunked body has none, so
		// it must NOT be rejected here even under a tiny cap — the host/proxy is the backstop.
		const handler = _serverHandler({
			schema,
			client: { componentCache: {}, registerProxy: vi.fn() } as any,
			production: true,
			manifest: {
				pages: {},
				pagesByUrl: {},
				formActions: {
					CreateUser: () => Promise.resolve({ default: createUserArtifact as any }),
				},
			} as any,
			assetPrefix: '',
			graphqlEndpoint: '/_api',
			componentCache: {},
			config_file: { router: { auth: { sessionKeys: [TOKEN_KEY] }, formMaxBodyBytes: 5 } } as any,
			on_render: () => new Response('page'),
		})
		const payload = new URLSearchParams({
			__houdini_csrf: validToken,
			__houdini_form: 'CreateUser',
			name: 'Alice',
		}).toString()
		// a ReadableStream body sends chunked with no Content-Length header
		const body = new ReadableStream({
			start(controller) {
				controller.enqueue(new TextEncoder().encode(payload))
				controller.close()
			},
		})
		const res = await handler(
			new Request('http://localhost/users/new', {
				method: 'POST',
				headers: { 'content-type': 'application/x-www-form-urlencoded', origin: 'http://localhost' },
				body,
				duplex: 'half',
			} as any)
		)
		// not a 413 — it ran the mutation for real (proving the guard was skipped, not that the
		// request silently failed)
		expect(res.status).toBe(303)
		expect(res.headers.get('location')).toBe('/users/7')
	})

	describe('GraphQL endpoint CSRF guard (CORS-simple POSTs)', () => {
		// these are the cross-origin channels that bypass preflight; none may reach Yoga
		// without the header our client sets.
		test('rejects an x-www-form-urlencoded POST (415)', async () => {
			const res = await serverWith()(
				formPOST('http://localhost/_api', {
					query: 'mutation { createUser(name: "x") { id } }',
				})
			)
			expect(res.status).toBe(415)
		})

		test('rejects a multipart POST without the x-houdini-request header (403)', async () => {
			const form = new FormData()
			form.set('operations', JSON.stringify({ query: 'mutation { createUser(name: "x") { id } }' }))
			const res = await serverWith()(
				new Request('http://localhost/_api', { method: 'POST', body: form })
			)
			expect(res.status).toBe(403)
		})

		test('lets a JSON POST through without the header (preflight already protects it)', async () => {
			// application/json is not a CORS-simple type, so it forces a preflight and needs
			// no extra header; it should reach Yoga and execute
			const res = await serverWith()(
				new Request('http://localhost/_api', {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({ query: 'mutation { createUser(name: "x") { id } }' }),
				})
			)
			expect(res.status).toBe(200)
		})
	})
})
