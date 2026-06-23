import type { ConfigFile } from '../lib/index.js'
import { getAuthUrl } from '../runtime/config.js'
import { sessionTokenFingerprint, verifySessionToken } from './auth-token.js'
import { parse } from './cookies.js'
import { decode, encode, verify } from './jwt.js'

type ServerHandlerArgs = {
	request: Request
	config: ConfigFile
	session_keys: string[]
}

// single-use store for relayed session-mint tokens, keyed by jti (per process). A token can be
// consumed exactly once; combined with its short TTL and sid binding this rejects replays of a
// leaked token. The legitimate relay consumes the jti within milliseconds of the mint. Caveats
// for fleet deployments: this Map is per-process, and a token minted under an *anonymous* prior
// session has the constant sid fingerprint({}), so sid adds no cross-session separation there —
// for anonymous-login tokens, jti + the short TTL are the only replay guard, and a shared store
// (not this Map) would be needed to enforce single-use across processes. (Tracked for the OAuth
// work, which binds the redirect flow to the browser with a single-use nonce instead.)
const SESSION_TOKEN_TTL_MS = 60 * 1000
const consumedSessionTokens = new Map<string, number>()
function consumeSessionToken(jti: string): boolean {
	const now = Date.now()
	for (const [id, expiry] of consumedSessionTokens) {
		if (expiry <= now) {
			consumedSessionTokens.delete(id)
		}
	}
	if (consumedSessionTokens.has(jti)) {
		return false
	}
	consumedSessionTokens.set(jti, now + SESSION_TOKEN_TTL_MS)
	return true
}

// applySessionToken verifies a relayed session-mint token and, if it checks out, writes the
// session it encodes onto `response`. The token must (1) carry a valid signature, (2) be bound
// (sid) to the session presenting it, and (3) not have been consumed before (jti) — so a leaked
// token can't be replayed from another session or replayed twice. Shared by the POST relay and
// the GET redirect callback so both paths are identically hardened. Returns false on any failure.
async function applySessionToken(
	args: ServerHandlerArgs,
	response: Response,
	token: unknown
): Promise<boolean> {
	const verified = await verifySessionToken(token, args.session_keys)
	if (!verified) {
		return false
	}
	const presenter = await get_session(args.request.headers, args.session_keys)
	const presenterSid = await sessionTokenFingerprint(presenter, args.session_keys)
	if (verified.sid !== presenterSid || !consumeSessionToken(verified.jti)) {
		return false
	}
	if ('clear' in verified) {
		clear_session(response)
	} else if (verified.merge) {
		await set_session(args, response, { ...presenter, ...verified.session })
	} else {
		await set_session(args, response, verified.session)
	}
	return true
}

// the actual server implementation changes from runtime to runtime
// so we want a single function that can be called to get the server
export async function handle_request(args: ServerHandlerArgs): Promise<Response | undefined> {
	const { pathname } = new URL(args.request.url)
	// the auth endpoint is always mounted (default path when unconfigured) so
	// progressively-enhanced @session forms and useSession() work out of the box
	if (pathname.startsWith(getAuthUrl(args.config))) {
		return await auth_endpoint(args)
	}
}

// the always-on session endpoint. GET sets the session from query params and redirects (an
// external redirect-based / OAuth-callback flow); POST sets it from either a server-signed
// session-mint token (the @session enhanced path — server-authoritative) or, for
// same-origin app code (useSession's updateSession), a raw values body.
async function auth_endpoint(args: ServerHandlerArgs): Promise<Response | undefined> {
	// GET: the redirect-based login callback. Opt-in (router.auth.redirect) so it isn't mounted
	// in apps that don't use it, and it only accepts a server-signed `token` (never raw query
	// params, which a cross-site GET could forge) — applySessionToken enforces the same
	// signature + session-binding + single-use checks as the POST relay.
	if (args.request.method === 'GET') {
		if (!args.config.router?.auth?.redirect) {
			return undefined
		}
		const { searchParams } = new URL(
			args.request.url!,
			`http://${args.request.headers.get('host')}`
		)
		const response = new Response('ok', {
			status: 302,
			headers: { Location: safeRelative(searchParams.get('redirectTo')) },
		})
		if (!(await applySessionToken(args, response, searchParams.get('token')))) {
			return new Response('Forbidden', { status: 403 })
		}
		return response
	}

	if (args.request.method === 'POST') {
		// fail-closed on the Origin header — a cross-origin page can't forge a session write
		const origin = args.request.headers.get('origin')
		const allowedOrigins = [
			new URL(args.request.url).origin,
			...(args.config.router?.allowedOrigins ?? []),
		]
		if (!origin || !allowedOrigins.includes(origin)) {
			return new Response('Forbidden', { status: 403 })
		}

		// no-JS logout: a native form POST (urlencoded/multipart) carrying the logout marker
		// clears the cookie and redirects. Origin-gated above; logout is low-risk (you can only
		// clear your own same-origin session), so no token is required.
		const contentType = args.request.headers.get('content-type') ?? ''
		if (contentType.includes('urlencoded') || contentType.includes('multipart')) {
			const formData = await args.request.formData()
			if (formData.get('__houdini_logout') == null) {
				return new Response('Bad Request', { status: 400 })
			}
			const response = new Response(null, {
				status: 303,
				headers: { Location: safeRelative(formData.get('redirectTo')) },
			})
			clear_session(response)
			return response
		}

		const body = (await args.request.json().catch(() => null)) as {
			token?: unknown
			session?: App.Session | null
		} | null
		if (!body || typeof body !== 'object') {
			return new Response('Bad Request', { status: 400 })
		}

		const response = new Response('ok', { status: 200 })

		// server-authoritative path: a relayed session-mint token. Its action was signed by the
		// server during the mutation's execution, so the client cannot tamper with it — a
		// non-null session replaces the cookie (login), a null one clears it (logout).
		if (typeof body.token === 'string') {
			if (!(await applySessionToken(args, response, body.token))) {
				return new Response('Forbidden', { status: 403 })
			}
			return response
		}

		// same-origin app path (updateSession). Origin-gated above; no token because
		// updateSession mutates the session across calls, which a session-bound token can't
		// track. `session: null` logs out (delete the cookie); a partial object merges.
		if (body.session === null) {
			clear_session(response)
			return response
		}
		const existing = await get_session(args.request.headers, args.session_keys)
		await set_session(args, response, { ...existing, ...(body.session ?? {}) })
		return response
	}
}

export type Server = {
	use(fn: ServerMiddleware): void
}

export type ServerMiddleware = (req: IncomingRequest, res: ServerResponse, next: () => void) => void

export type IncomingRequest = {
	url?: string
	headers: Headers
}

export type ServerResponse = {
	redirect(url: string, status?: number): void
	set_header(name: string, value: string): void
}

export const session_cookie_name = '__houdini__'

// clear_session deletes the session cookie (logout) by writing an immediately-expiring
// Set-Cookie. Unlike set_session({}), this removes the cookie rather than re-signing an empty
// payload.
export function clear_session(response: Response) {
	response.headers.set(
		'Set-Cookie',
		`${session_cookie_name}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`
	)
}

// safeRelative guards a redirect target against open-redirect: only a single-leading-slash
// relative path is allowed, anything else falls back to '/'. Backslashes are rejected because
// the WHATWG URL parser normalizes them to forward slashes, so '/\evil.com' would otherwise
// resolve to 'https://evil.com/'.
function safeRelative(value: unknown): string {
	if (
		typeof value !== 'string' ||
		!value.startsWith('/') ||
		value.startsWith('//') ||
		value.includes('\\') ||
		value.includes('://')
	) {
		return '/'
	}
	return value
}

export async function set_session(req: ServerHandlerArgs, response: Response, value: App.Session) {
	const today = new Date()
	const expires = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000) // Add 7 days in milliseconds

	// serialize the value
	const serialized = await encode(value, req.session_keys[0])

	// set the cookie with a header
	response.headers.set(
		'Set-Cookie',
		`${session_cookie_name}=${serialized}; Path=/; HttpOnly; Secure; SameSite=Lax; Expires=${expires.toUTCString()} `
	)
}

export async function get_session(req: Headers, secrets: string[]): Promise<App.Session> {
	// get the cookie header
	const cookies = req.get('cookie')
	if (!cookies) {
		return {}
	}
	const cookie = parse(cookies)[session_cookie_name]
	if (!cookie) {
		return {}
	}
	if (cookie === '{}') {
		return {}
	}

	// decode it with any of the available secrets. A malformed (non-JWT) cookie — e.g. a raw
	// value injected by a proxy or a client — must fail closed to {} rather than throw out of
	// the context factory, so an unsigned value can never become the session.
	for (const secret of secrets) {
		try {
			// check if its valid
			if (!(await verify(cookie, secret))) {
				continue
			}

			// parse the cookie header
			const parsed = decode(cookie)
			if (!parsed) {
				return {}
			}

			return parsed.payload as App.Session
		} catch {
			continue
		}
	}

	// if we got this far then the cookie value didn't match any of the available secrets
	return {}
}
