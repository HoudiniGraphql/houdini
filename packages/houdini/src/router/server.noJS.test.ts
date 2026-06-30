import { createSchema } from 'graphql-yoga'
import { test, expect, describe, vi, beforeAll, afterEach } from 'vitest'

import { _serverHandler, signFormToken } from './server.js'
import { signSessionToken } from './auth-token.js'
import { encode } from './jwt.js'
import { get_session, session_cookie_name, sign_session } from './session.js'

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
			whoami: String
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
		Query: {
			// reflects the session the in-process resolver actually sees — used to prove the
			// registerProxy path hands the local handler a session get_session accepts
			whoami: (_p: unknown, _a: unknown, ctx: any) => ctx.session?.userId ?? null,
		},
		Mutation: {
			createUser: (_: unknown, { name }: { name: string }) => ({ id: '7', name }),
			// the resolver decides the session payload (server-authoritative)
			login: (_: unknown, { email }: { email: string }) => ({
				session: { token: 'tok-' + email },
			}),
			// a failed login returns a null session — must NOT clear the existing session
			maybeLogin: (_: unknown, { ok }: { ok: boolean }) => ({
				session: ok ? { token: 'ok' } : null,
			}),
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
	router: { auth: {} },
	scalars: {
		Timestamp: {
			type: 'Date',
			marshal: (date: Date) => date.getTime(),
			unmarshal: (value: number) => new Date(value),
		},
	},
}

// sessionKeys live in the server-only config (src/server/+config → HoudiniServerConfig), separate
// from config_file, so the secret can't reach the client bundle.
const serverConfig = { auth: { sessionKeys: [TOKEN_KEY] } }

function serverWith(
	onRender: (args: any) => any = () => new Response('page'),
	// merged into server_config.auth (e.g. { redirect: true }) — auth config is server-only now
	authOverride: Record<string, any> = {}
) {
	const config_file = scalarConfig
	const server_config = { ...serverConfig, auth: { ...serverConfig.auth, ...authOverride } }
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
		server_config,
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
		const session = await get_session(new Headers({ cookie: setCookie.split(';')[0] }), [
			TOKEN_KEY,
		])
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
		const query =
			'mutation Login($email: String!) { login(email: $email) { session { token } } }'
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
				config_file: {} as any,
				server_config: { ...serverConfig, allowedOrigins: ['http://trusted.com'] },
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
			config_file: {} as any,
			server_config: { ...serverConfig, formMaxBodyBytes: 5 },
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

	// a chunked body has no Content-Length, so the header check can't catch it; the handler counts
	// bytes while reading and rejects an over-cap body anyway. Returns the handler + a chunked Request.
	const chunkedFormRequest = (maxBodyBytes: number) => {
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
			config_file: {} as any,
			server_config: { ...serverConfig, formMaxBodyBytes: maxBodyBytes },
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
		const request = new Request('http://localhost/users/new', {
			method: 'POST',
			headers: {
				'content-type': 'application/x-www-form-urlencoded',
				origin: 'http://localhost',
			},
			body,
			duplex: 'half',
		} as any)
		return { handler, request }
	}

	test('rejects a chunked body (no Content-Length) over the cap (413)', async () => {
		// the streamed-read guard must trip even with no Content-Length to lean on
		const { handler, request } = chunkedFormRequest(5)
		const res = await handler(request)
		expect(res.status).toBe(413)
	})

	test('accepts a chunked body (no Content-Length) under the cap', async () => {
		// and it must NOT reject a legitimate small chunked body — the rebuilt request still parses
		const { handler, request } = chunkedFormRequest(10 * 1024)
		const res = await handler(request)
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
			form.set(
				'operations',
				JSON.stringify({ query: 'mutation { createUser(name: "x") { id } }' })
			)
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
		const authUrl = 'http://localhost/_auth'

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
					body: new URLSearchParams({
						__houdini_logout: '1',
						redirectTo: 'https://evil.com',
					}),
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
					headers: {
						'content-type': 'application/json',
						origin: 'http://localhost',
						cookie,
					},
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
			const mergeToken = await signSessionToken(
				{ theme: 'dark' } as any,
				[TOKEN_KEY],
				true,
				prior
			)
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

		test('a configured consumedTokenStore overrides the default (shared single-use)', async () => {
			// a store that vetoes (as a shared store would for a token already burned on another
			// instance) must reject even a first-seen token here — proving the custom store is consulted
			const consumed: string[] = []
			const handler = serverWith(undefined, {
				consumedTokenStore: {
					consume: (jti: string) => {
						consumed.push(jti)
						return false
					},
				},
			})
			const token = await signSessionToken(
				{ token: 'tok-shared' } as any,
				[TOKEN_KEY],
				false,
				{}
			)
			expect((await relay(handler, '', token)).status).toBe(403)
			expect(consumed).toHaveLength(1) // the store, not the in-memory default, was asked
		})

		// the redirect-login escape hatch: /login binds the round-trip to the browser with a
		// single-use nonce (txn cookie); the callback only establishes a session when the trusted
		// integration echoes that nonce back as `state` AND presents a validly-signed token.
		const WORKER = 'https://worker.example/login'

		test('a GET callback sets NO cookie when redirect is not configured (default)', async () => {
			const handler = serverWith()
			const res = await handler(
				new Request(`${authUrl}?state=x&token=y&redirectTo=/`, { method: 'GET' })
			)
			// not configured → the sink isn't mounted; nothing writes a session cookie
			expect(res?.headers.get('set-cookie') ?? null).toBeNull()
		})

		test('/login redirects to the configured integration with a nonce + sets the txn cookie', async () => {
			const handler = serverWith(undefined, { redirect: { url: WORKER } })
			const res = await handler(
				new Request(`${authUrl}/login?redirectTo=/home&provider=github`, { method: 'GET' })
			)
			expect(res!.status).toBe(302)
			const loc = new URL(res!.headers.get('location')!)
			expect(loc.origin + loc.pathname).toBe(WORKER)
			// app params forwarded to the integration; state (nonce) + return (our callback) added
			expect(loc.searchParams.get('provider')).toBe('github')
			expect(loc.searchParams.get('state')).toBeTruthy()
			expect(loc.searchParams.get('return')).toContain('/_auth')
			// redirectTo is NOT forwarded — it's kept in the signed cookie, off the open wire
			expect(loc.searchParams.get('redirectTo')).toBeNull()
			expect(res!.headers.get('set-cookie') ?? '').toContain('__Host-houdini-txn=')
		})

		test('the callback rejects when the nonce does not match the txn cookie (browser binding)', async () => {
			const handler = serverWith(undefined, { redirect: { url: WORKER } })
			const start = await handler(
				new Request(`${authUrl}/login?redirectTo=/home`, { method: 'GET' })
			)
			const txn = (start!.headers.get('set-cookie') ?? '').split(';')[0]
			const token = await signSessionToken({ token: 'x' } as any, [TOKEN_KEY], false, {})
			const res = await handler(
				new Request(`${authUrl}?state=not-the-nonce&token=${token}`, {
					method: 'GET',
					headers: { cookie: txn },
				})
			)
			expect(res!.status).toBe(403)
		})

		test('the callback rejects a matching nonce with no valid token', async () => {
			const handler = serverWith(undefined, { redirect: { url: WORKER } })
			const start = await handler(
				new Request(`${authUrl}/login?redirectTo=/home`, { method: 'GET' })
			)
			const txn = (start!.headers.get('set-cookie') ?? '').split(';')[0]
			const nonce = new URL(start!.headers.get('location')!).searchParams.get('state')!
			const res = await handler(
				new Request(`${authUrl}?state=${nonce}&token=garbage`, {
					method: 'GET',
					headers: { cookie: txn },
				})
			)
			expect(res!.status).toBe(403)
		})

		test('the callback establishes the session when the nonce matches + the token is valid', async () => {
			const handler = serverWith(undefined, { redirect: { url: WORKER } })
			const start = await handler(
				new Request(`${authUrl}/login?redirectTo=/home`, { method: 'GET' })
			)
			const txn = (start!.headers.get('set-cookie') ?? '').split(';')[0]
			const nonce = new URL(start!.headers.get('location')!).searchParams.get('state')!
			const token = await signSessionToken(
				{ token: 'tok-oauth' } as any,
				[TOKEN_KEY],
				false,
				{}
			)
			const res = await handler(
				new Request(`${authUrl}?state=${nonce}&token=${token}`, {
					method: 'GET',
					headers: { cookie: txn },
				})
			)
			expect(res!.status).toBe(302)
			// the landing path comes from the signed cookie, not the query string
			expect(res!.headers.get('location')).toBe('/home')
			const setCookies = res!.headers.getSetCookie()
			const sessionCookie = setCookies.find((c) => c.startsWith('__houdini__='))!
			const session = await get_session(
				new Headers({ cookie: sessionCookie.split(';')[0] }),
				[TOKEN_KEY]
			)
			expect((session as any).token).toBe('tok-oauth')
			// the txn cookie is burned (single-use)
			expect(setCookies.some((c) => c.startsWith('__Host-houdini-txn=;'))).toBe(true)
		})

		test('/login with no redirectTo defaults to the current page (same-origin Referer)', async () => {
			const handler = serverWith(undefined, { redirect: { url: WORKER } })
			const start = await handler(
				new Request(`${authUrl}/login`, {
					method: 'GET',
					headers: { referer: 'http://localhost/articles/42' },
				})
			)
			const txn = (start!.headers.get('set-cookie') ?? '').split(';')[0]
			const nonce = new URL(start!.headers.get('location')!).searchParams.get('state')!
			const token = await signSessionToken({ token: 't' } as any, [TOKEN_KEY], false, {})
			const res = await handler(
				new Request(`${authUrl}?state=${nonce}&token=${token}`, {
					method: 'GET',
					headers: { cookie: txn },
				})
			)
			expect(res!.status).toBe(302)
			// landed back on the page they came from, carried through the signed cookie
			expect(res!.headers.get('location')).toBe('/articles/42')
		})

		test('/login ignores a cross-origin Referer (falls back to /)', async () => {
			const handler = serverWith(undefined, { redirect: { url: WORKER } })
			const start = await handler(
				new Request(`${authUrl}/login`, {
					method: 'GET',
					headers: { referer: 'http://evil.com/trap' },
				})
			)
			const txn = (start!.headers.get('set-cookie') ?? '').split(';')[0]
			const nonce = new URL(start!.headers.get('location')!).searchParams.get('state')!
			const token = await signSessionToken({ token: 't' } as any, [TOKEN_KEY], false, {})
			const res = await handler(
				new Request(`${authUrl}?state=${nonce}&token=${token}`, {
					method: 'GET',
					headers: { cookie: txn },
				})
			)
			expect(res!.headers.get('location')).toBe('/')
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

// the server-side half of session-endpoint injection: _serverHandler resolves the session endpoint
// from the (server-only) server_config and hands it to on_render, which serializes it into the page
// (window.__houdini__auth_url__) for the client to read at hydration. The GraphQL endpoint is NOT
// injected — it's public config the client reads from the bundle — so it isn't passed to on_render.
describe('session endpoint injection (server side)', () => {
	test('resolves the session endpoint from server_config and passes it to on_render', async () => {
		let captured: any = null
		const handler = _serverHandler({
			schema,
			client: { componentCache: {}, registerProxy: vi.fn() } as any,
			production: true,
			manifest: { pages: {}, pagesByUrl: {}, formActions: {} } as any,
			assetPrefix: '',
			graphqlEndpoint: '/_api',
			componentCache: {},
			config_file: {} as any,
			server_config: {
				auth: { sessionKeys: [TOKEN_KEY], url: '/auth/token' },
			},
			on_render: (args: any) => {
				captured = args
				return new Response('page')
			},
		})
		// a plain page GET (no matching page → 404 render) still flows through on_render
		await handler(new Request('http://localhost/'))
		expect(captured?.authUrl).toBe('/auth/token')
		// the GraphQL endpoint is not injected; the client derives it from the public config
		expect(captured?.apiEndpoint).toBeUndefined()
	})
})

describe('session cookie lifecycle', () => {
	test('an expired session cookie is rejected (get_session → {})', async () => {
		// a cookie whose signed exp has passed must fail closed, not be honored until the browser
		// drops it — so a stolen cookie value stops working server-side
		const value = await encode(
			{ userId: 'u1', exp: Math.floor(Date.now() / 1000) - 10 },
			TOKEN_KEY
		)
		const headers = new Headers({ cookie: `${session_cookie_name}=${value}` })
		expect(await get_session(headers, [TOKEN_KEY])).toEqual({})
	})

	test('get_session strips reserved claims (exp/iat) from the session', async () => {
		const value = await encode(
			{ userId: 'u1', exp: Math.floor(Date.now() / 1000) + 100 },
			TOKEN_KEY
		)
		const headers = new Headers({ cookie: `${session_cookie_name}=${value}` })
		// exp (and the iat encode adds) must not leak into the app-visible session object
		expect(await get_session(headers, [TOKEN_KEY])).toEqual({ userId: 'u1' })
	})

	test('sign_session round-trips through get_session (the in-process proxy path)', async () => {
		// the proxy hands the in-process handler a SIGNED session; get_session must accept it (a raw
		// JSON value would fail verification and the handler would run session-less)
		const cookie = `${session_cookie_name}=${await sign_session({ userId: 'u1' } as any, TOKEN_KEY)}`
		expect(await get_session(new Headers({ cookie }), [TOKEN_KEY])).toEqual({ userId: 'u1' })
	})

	test('registerProxy makes the session visible to the in-process resolver', async () => {
		// drive the REAL proxy callback (not sign_session in isolation): a query that resolves
		// against the local schema must see the session passed to the proxy. A raw JSON cookie
		// would be rejected by get_session and the resolver would run session-less (the bug).
		const client: any = { componentCache: {}, registerProxy: vi.fn() }
		_serverHandler({
			schema,
			client,
			production: true,
			manifest: { pages: {}, pagesByUrl: {}, formActions: {}, sessionMutations: {} } as any,
			assetPrefix: '',
			graphqlEndpoint: '/_api',
			componentCache: {},
			config_file: scalarConfig as any,
			server_config: serverConfig,
			on_render: () => new Response('page'),
		})
		const proxy = client.registerProxy.mock.calls[0][1]
		const result = await proxy({
			query: '{ whoami }',
			variables: {},
			session: { userId: 'u1' },
		})
		expect(result.data.whoami).toBe('u1')
	})
})

// first-class OAuth: Houdini runs the Authorization Code + PKCE flow itself against a configured
// provider (here a stub), exchanging the code and validating the id_token server-side.
describe('first-class OAuth', () => {
	afterEach(() => vi.unstubAllGlobals())

	const authUrl = 'http://localhost/_auth'
	const stubProvider: any = {
		clientId: 'cid',
		clientSecret: 'csecret',
		scopes: ['openid', 'email'],
		pkce: 'S256',
		issuer: 'https://stub.test',
		server: async () => ({
			issuer: 'https://stub.test',
			authorization_endpoint: 'https://stub.test/authorize',
			token_endpoint: 'https://stub.test/token',
			jwks_uri: 'https://stub.test/jwks',
		}),
		user: ({ claims }: any) => ({ sub: claims.sub, email: claims.email }),
	}
	const withOAuth = () =>
		serverWith(undefined, {
			providers: { stub: stubProvider },
			onSignIn: ({ user }: any) => ({ userId: user.sub }),
		})

	// mint a real RS256-signed id_token + the matching JWKS — oauth4webapi verifies the signature
	// against the issuer's keys, so the stub has to sign properly (no alg:none shortcut)
	async function signedIdToken(claims: any, kid = 'k1') {
		const { publicKey, privateKey } = await crypto.subtle.generateKey(
			{
				name: 'RSASSA-PKCS1-v1_5',
				modulusLength: 2048,
				publicExponent: new Uint8Array([1, 0, 1]),
				hash: 'SHA-256',
			},
			true,
			['sign', 'verify']
		)
		const part = (o: any) => Buffer.from(JSON.stringify(o)).toString('base64url')
		const data = `${part({ alg: 'RS256', typ: 'JWT', kid })}.${part(claims)}`
		const sig = await crypto.subtle.sign(
			'RSASSA-PKCS1-v1_5',
			privateKey,
			new TextEncoder().encode(data)
		)
		const token = `${data}.${Buffer.from(new Uint8Array(sig)).toString('base64url')}`
		const jwk: any = await crypto.subtle.exportKey('jwk', publicKey)
		return { token, jwks: { keys: [{ ...jwk, kid, use: 'sig', alg: 'RS256' }] } }
	}

	// a fetch that answers the stub's token endpoint (the signed id_token) and its jwks_uri
	const stubFetch = (token: string, jwks: any) =>
		vi.fn(async (input: any) => {
			const url = typeof input === 'string' ? input : input.url
			if (url.endsWith('/jwks')) {
				return new Response(JSON.stringify(jwks), {
					headers: { 'content-type': 'application/json' },
				})
			}
			return new Response(
				JSON.stringify({ access_token: 'at', token_type: 'bearer', id_token: token }),
				{ headers: { 'content-type': 'application/json' } }
			)
		})

	const startFlow = async (handler: any) => {
		const start = await handler(
			new Request(`${authUrl}/login?provider=stub&redirectTo=/home`, { method: 'GET' })
		)
		const authorize = new URL(start!.headers.get('location')!)
		return {
			state: authorize.searchParams.get('state')!,
			nonce: authorize.searchParams.get('nonce')!,
			txn: (start!.headers.get('set-cookie') ?? '').split(';')[0],
		}
	}

	test('/login?provider mints PKCE/state/nonce, sets the txn cookie, 302s to the authorize URL', async () => {
		const res = await withOAuth()(
			new Request(`${authUrl}/login?provider=stub&redirectTo=/home`, { method: 'GET' })
		)
		expect(res!.status).toBe(302)
		const u = new URL(res!.headers.get('location')!)
		expect(u.origin + u.pathname).toBe('https://stub.test/authorize')
		expect(u.searchParams.get('client_id')).toBe('cid')
		expect(u.searchParams.get('response_type')).toBe('code')
		expect(u.searchParams.get('code_challenge_method')).toBe('S256')
		expect(u.searchParams.get('code_challenge')).toBeTruthy()
		expect(u.searchParams.get('state')).toBeTruthy()
		expect(u.searchParams.get('nonce')).toBeTruthy()
		expect(u.searchParams.get('redirect_uri')).toContain('/_auth')
		expect(res!.headers.get('set-cookie') ?? '').toContain('__Host-houdini-txn=')
	})

	test('an unknown provider is rejected (400)', async () => {
		const res = await withOAuth()(
			new Request(`${authUrl}/login?provider=nope`, { method: 'GET' })
		)
		expect(res!.status).toBe(400)
	})

	test('the callback exchanges the code, validates the signed id_token, and establishes the session', async () => {
		const handler = withOAuth()
		const { state, nonce, txn } = await startFlow(handler)

		const now = Math.floor(Date.now() / 1000)
		const { token, jwks } = await signedIdToken({
			iss: 'https://stub.test',
			aud: 'cid',
			sub: 'u1',
			email: 'u@x.com',
			iat: now,
			exp: now + 3600,
			nonce,
		})
		vi.stubGlobal('fetch', stubFetch(token, jwks))

		const res = await handler(
			new Request(`${authUrl}?state=${state}&code=abc`, {
				method: 'GET',
				headers: { cookie: txn },
			})
		)
		expect(res!.status).toBe(302)
		expect(res!.headers.get('location')).toBe('/home')
		const setCookies = res!.headers.getSetCookie()
		const sessionCookie = setCookies.find((c) => c.startsWith('__houdini__='))!
		const session = await get_session(new Headers({ cookie: sessionCookie.split(';')[0] }), [
			TOKEN_KEY,
		])
		expect(session).toMatchObject({ userId: 'u1' })
		expect(setCookies.some((c) => c.startsWith('__Host-houdini-txn=;'))).toBe(true)
	})

	test('a signed id_token with the wrong nonce is rejected (403)', async () => {
		const handler = withOAuth()
		const { state, txn } = await startFlow(handler)

		const now = Math.floor(Date.now() / 1000)
		const { token, jwks } = await signedIdToken({
			iss: 'https://stub.test',
			aud: 'cid',
			sub: 'u1',
			iat: now,
			exp: now + 3600,
			nonce: 'WRONG-NONCE',
		})
		vi.stubGlobal('fetch', stubFetch(token, jwks))

		const res = await handler(
			new Request(`${authUrl}?state=${state}&code=abc`, {
				method: 'GET',
				headers: { cookie: txn },
			})
		)
		expect(res!.status).toBe(403)
	})
})
