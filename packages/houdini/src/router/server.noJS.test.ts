import { createSchema } from 'graphql-yoga'
import { test, expect, describe, vi, beforeAll } from 'vitest'

import { _serverHandler, signFormToken } from './server.js'
import { signSessionToken } from './auth-token.js'
import { get_session } from './session.js'

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
		type SessionInfo {
			token: String!
		}
		type LoginResult {
			session: SessionInfo!
		}
		type MaybeLoginResult {
			session: SessionInfo
		}
		type Mutation {
			createUser(name: String!): User!
			boom: User!
			uploadAvatar(file: File!): User!
			createEvent(at: Timestamp!): User!
			login(email: String!): LoginResult!
			maybeLogin(ok: Boolean!): MaybeLoginResult!
		}
	`,
	resolvers: {
		Mutation: {
			createUser: (_: unknown, { name }: { name: string }) => ({ id: '7', name }),
			// the resolver decides the session payload (server-authoritative)
			login: (_: unknown, { email }: { email: string }) => ({ session: { token: 'tok-' + email } }),
			// a failed login returns a null session — must NOT clear the existing session
			maybeLogin: (_: unknown, { ok }: { ok: boolean }) => ({ session: ok ? { token: 'ok' } : null }),
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

// a login mutation that is both a form (@endpoint) and session-establishing (@session) — its
// `login.session` result subtree becomes the session cookie
const loginArtifact = {
	name: 'Login',
	kind: 'HoudiniMutation',
	raw: 'mutation Login($email: String!) { login(email: $email) { session { token } } }',
	input: { fields: { email: 'String' }, types: {}, defaults: {}, runtimeScalars: {} },
	endpoint: { redirect: ['/dashboard'] },
	sessionPath: 'login.session',
}

const maybeLoginArtifact = {
	name: 'MaybeLogin',
	kind: 'HoudiniMutation',
	raw: 'mutation MaybeLogin($ok: Boolean!) { maybeLogin(ok: $ok) { session { token } } }',
	input: { fields: { ok: 'Boolean' }, types: {}, defaults: {}, runtimeScalars: {} },
	endpoint: { redirect: ['/dashboard'] },
	sessionPath: 'maybeLogin.session',
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

function serverWith(
	onRender: (args: any) => any = () => new Response('page'),
	authOverride: Record<string, any> = {}
) {
	const config_file = {
		...scalarConfig,
		router: {
			...scalarConfig.router,
			auth: { ...scalarConfig.router.auth, ...authOverride },
		},
	}
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
				Login: () => Promise.resolve({ default: loginArtifact as any }),
				MaybeLogin: () => Promise.resolve({ default: maybeLoginArtifact as any }),
			},
			sessionMutations: {
				Login: { sessionPath: 'login.session' },
				MaybeLogin: { sessionPath: 'maybeLogin.session' },
			},
		} as any,
		assetPrefix: '',
		graphqlEndpoint: '/_api',
		componentCache: {},
		config_file: config_file as any,
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

	test('a no-JS @session login sets the session cookie from the resolver', async () => {
		const handler = serverWith()
		const res = await handler(
			formPOST('http://localhost/login', { __houdini_form: 'Login', email: 'a@b.co' })
		)
		expect(res.status).toBe(303)
		expect(res.headers.get('location')).toBe('/dashboard')
		// the resolver's session subtree (login.session) was written to the cookie, server-side
		const setCookie = res.headers.get('set-cookie') ?? ''
		expect(setCookie).toContain('__houdini__=')
		const session = await get_session(
			new Headers({ cookie: setCookie.split(';')[0] }),
			[TOKEN_KEY]
		)
		expect((session as any).token).toBe('tok-a@b.co')
	})

	test('a no-JS @session mutation that succeeds with a null session clears the cookie (logout)', async () => {
		// a successful @session whose session field comes back null is a server-side logout — it
		// deletes the cookie (Max-Age=0)
		const handler = serverWith()
		const res = await handler(
			formPOST('http://localhost/login', { __houdini_form: 'MaybeLogin', ok: '' })
		)
		expect(res.status).toBe(303)
		expect(res.headers.get('set-cookie')).toContain('Max-Age=0')
	})

	test('the session-mint plugin mints a token for an @session mutation but skips the internal form request', async () => {
		const handler = serverWith()
		const query = 'mutation Login($email: String!) { login(email: $email) { session { token } } }'
		const body = JSON.stringify({ query, variables: { email: 'a@b.co' } })

		// a normal GraphQL execution mints the server-signed token into extensions (the enhanced
		// path the client relays); proves the plugin is wired and reads context.request
		const normal = await handler(
			new Request('http://localhost/_api', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body,
			})
		)
		expect((await normal.json()).extensions?.houdiniSession).toBeTruthy()

		// the same execution marked as the no-JS form's internal request is skipped (the form
		// handler sets the cookie itself, so a token here would be minted and discarded)
		const internal = await handler(
			new Request('http://localhost/_api', {
				method: 'POST',
				headers: { 'content-type': 'application/json', 'x-houdini-internal-form': '1' },
				body,
			})
		)
		expect((await internal.json()).extensions?.houdiniSession).toBeUndefined()
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

	describe('logout / clear endpoint', () => {
		const authUrl = 'http://localhost/__houdini__/auth'

		test('POST { session: null } clears the session cookie (updateSession(null))', async () => {
			const res = await serverWith()(
				new Request(authUrl, {
					method: 'POST',
					headers: { 'content-type': 'application/json', origin: 'http://localhost' },
					body: JSON.stringify({ session: null }),
				})
			)
			expect(res.status).toBe(200)
			expect(res.headers.get('set-cookie')).toContain('Max-Age=0')
		})

		test('POST { session: {...} } still merges (not a logout)', async () => {
			const res = await serverWith()(
				new Request(authUrl, {
					method: 'POST',
					headers: { 'content-type': 'application/json', origin: 'http://localhost' },
					body: JSON.stringify({ session: { token: 'x' } }),
				})
			)
			expect(res.status).toBe(200)
			// a merge writes a normal (non-expiring) cookie
			expect(res.headers.get('set-cookie')).not.toContain('Max-Age=0')
		})

		test('a native form logout clears the cookie and 303s to redirectTo', async () => {
			const res = await serverWith()(
				new Request(authUrl, {
					method: 'POST',
					headers: {
						'content-type': 'application/x-www-form-urlencoded',
						origin: 'http://localhost',
					},
					body: new URLSearchParams({ __houdini_logout: '1', redirectTo: '/bye' }),
				})
			)
			expect(res.status).toBe(303)
			expect(res.headers.get('location')).toBe('/bye')
			expect(res.headers.get('set-cookie')).toContain('Max-Age=0')
		})

		test('a logout redirectTo to an external URL falls back to / (no open redirect)', async () => {
			const res = await serverWith()(
				new Request(authUrl, {
					method: 'POST',
					headers: {
						'content-type': 'application/x-www-form-urlencoded',
						origin: 'http://localhost',
					},
					body: new URLSearchParams({ __houdini_logout: '1', redirectTo: 'https://evil.com' }),
				})
			)
			expect(res.headers.get('location')).toBe('/')
		})

		test('a logout redirectTo using backslashes falls back to / (no open redirect)', async () => {
			// the WHATWG URL parser normalizes '\' to '/', so '/\evil.com' would resolve to
			// 'https://evil.com/' without an explicit backslash guard
			const res = await serverWith()(
				new Request(authUrl, {
					method: 'POST',
					headers: {
						'content-type': 'application/x-www-form-urlencoded',
						origin: 'http://localhost',
					},
					body: new URLSearchParams({ __houdini_logout: '1', redirectTo: '/\\evil.com' }),
				})
			)
			expect(res.headers.get('location')).toBe('/')
		})

		// relay a token bound to (sid) the given session cookie, as the mint plugin would
		const relay = (handler: any, cookie: string, token: string) =>
			handler(
				new Request(authUrl, {
					method: 'POST',
					headers: { 'content-type': 'application/json', origin: 'http://localhost', cookie },
					body: JSON.stringify({ token }),
				})
			)

		test('a merge session token upserts into the existing session (preferences)', async () => {
			const handler = serverWith()
			// log in first → session cookie carries { token }
			const login = await handler(
				formPOST('http://localhost/login', { __houdini_form: 'Login', email: 'a@b.co' })
			)
			const cookie = (login.headers.get('set-cookie') ?? '').split(';')[0]
			// the mint binds the token to the session it ran under, so derive that session here
			const prior = await get_session(new Headers({ cookie }), [TOKEN_KEY])

			// relay a merge token that adds { theme: 'dark' } — like a @session(merge: true) pref
			const mergeToken = await signSessionToken({ theme: 'dark' } as any, [TOKEN_KEY], true, prior)
			const res = await relay(handler, cookie, mergeToken)
			expect(res.status).toBe(200)
			const session = await get_session(
				new Headers({ cookie: (res.headers.get('set-cookie') ?? '').split(';')[0] }),
				[TOKEN_KEY]
			)
			expect((session as any).token).toBe('tok-a@b.co') // kept from login
			expect((session as any).theme).toBe('dark') // merged in
		})

		test('a token minted under a different session is rejected (sid binding)', async () => {
			const handler = serverWith()
			const login = await handler(
				formPOST('http://localhost/login', { __houdini_form: 'Login', email: 'a@b.co' })
			)
			const cookie = (login.headers.get('set-cookie') ?? '').split(';')[0]
			// token bound to a DIFFERENT session than the one presenting it
			const token = await signSessionToken({ theme: 'dark' } as any, [TOKEN_KEY], true, {
				token: 'someone-else',
			} as any)
			expect((await relay(handler, cookie, token)).status).toBe(403)
		})

		test('a session-mint token cannot be replayed (single-use jti)', async () => {
			const handler = serverWith()
			// no prior session → token bound to the empty session, presented with no cookie
			const token = await signSessionToken({ token: 'tok-x' } as any, [TOKEN_KEY], false, {})
			expect((await relay(handler, '', token)).status).toBe(200)
			// the same token a second time is rejected
			expect((await relay(handler, '', token)).status).toBe(403)
		})

		// Login-CSRF guard: the GET cookie-write sink must not be exposed by default, and even
		// when enabled it must not turn raw query params into a signed session.
		test('a GET with raw param session sets NO cookie when redirect is off (default)', async () => {
			const handler = serverWith()
			const res = await handler(
				new Request(`${authUrl}?role=admin&userId=evil&redirectTo=/`, { method: 'GET' })
			)
			// gated off → the sink isn't mounted; nothing writes a session cookie
			expect(res?.headers.get('set-cookie') ?? null).toBeNull()
		})

		test('a GET with raw params (no signed token) is rejected even when redirect is enabled', async () => {
			const handler = serverWith(undefined, { redirect: true })
			const res = await handler(
				new Request(`${authUrl}?role=admin&userId=evil&redirectTo=/`, { method: 'GET' })
			)
			expect(res!.status).toBe(403)
			expect(res!.headers.get('set-cookie') ?? null).toBeNull()
		})

		test('a GET with a valid signed token sets the session when redirect is enabled', async () => {
			const handler = serverWith(undefined, { redirect: true })
			// minted bound to the empty (anonymous) session the browser presents
			const token = await signSessionToken({ token: 'tok-oauth' } as any, [TOKEN_KEY], false, {})
			const res = await handler(
				new Request(`${authUrl}?token=${token}&redirectTo=/home`, { method: 'GET' })
			)
			expect(res!.status).toBe(302)
			expect(res!.headers.get('location')).toBe('/home')
			const session = await get_session(
				new Headers({ cookie: (res!.headers.get('set-cookie') ?? '').split(';')[0] }),
				[TOKEN_KEY]
			)
			expect((session as any).token).toBe('tok-oauth')
		})

		test('a cross-origin logout is rejected (Origin fail-closed)', async () => {
			const res = await serverWith()(
				new Request(authUrl, {
					method: 'POST',
					headers: {
						'content-type': 'application/x-www-form-urlencoded',
						origin: 'http://evil.com',
					},
					body: new URLSearchParams({ __houdini_logout: '1' }),
				})
			)
			expect(res.status).toBe(403)
		})
	})
})
