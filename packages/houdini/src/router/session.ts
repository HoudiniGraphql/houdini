import * as oauth from 'oauth4webapi'

import type { ConfigFile, ConsumedTokenStore, ServerConfigFile } from '../lib/index.js'
import type { OAuthProvider, OAuthTokens } from '../oauth/index.js'
import { getAuthUrl } from '../runtime/config.js'
import {
	sessionTokenFingerprint,
	verifySessionToken,
	signRedirectTxn,
	verifyRedirectTxn,
	randomToken,
	timingSafeEqual,
	REDIRECT_TXN_TTL_SECONDS,
	type RedirectTxn,
} from './auth-token.js'
import { parse } from './cookies.js'
import { decode, encode, verify } from './jwt.js'

// the redirect-login transaction cookie: __Host- (host-locked, Secure, Path=/), HttpOnly, and
// SameSite=Lax so it rides the top-level GET navigation back from the trusted integration but not
// embedded cross-site requests. Max-Age mirrors the signed txn TTL.
const REDIRECT_TXN_COOKIE = '__Host-houdini-txn'
function redirectTxnCookie(value: string): string {
	return `${REDIRECT_TXN_COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${REDIRECT_TXN_TTL_SECONDS}`
}
function clearRedirectTxnCookie(): string {
	return `${REDIRECT_TXN_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`
}

type ServerHandlerArgs = {
	request: Request
	config: ConfigFile
	// server-only config (src/server/+config): the session endpoint, redirect flag, CSRF allowlist
	server_config?: ServerConfigFile
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
// the default single-use store: an in-memory Map. It is PER-PROCESS, so it only enforces single-use
// within one instance (see the multi-instance caveat on ConsumedTokenStore). A deployment can swap
// in a shared store via server_config.auth.consumedTokenStore.
const consumedSessionTokens = new Map<string, number>()
const defaultConsumedTokenStore: ConsumedTokenStore = {
	consume(jti, ttlMs) {
		const now = Date.now()
		for (const [id, expiry] of consumedSessionTokens) {
			if (expiry <= now) {
				consumedSessionTokens.delete(id)
			}
		}
		if (consumedSessionTokens.has(jti)) {
			return false
		}
		consumedSessionTokens.set(jti, now + ttlMs)
		return true
	},
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
	const store = args.server_config?.auth?.consumedTokenStore ?? defaultConsumedTokenStore
	if (
		!timingSafeEqual(verified.sid, presenterSid) ||
		!(await store.consume(verified.jti, SESSION_TOKEN_TTL_MS))
	) {
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
	const authUrl = getAuthUrl()
	// the redirect-login initiation endpoint, distinct from the cookie-setting callback at the root
	if (pathname === authUrl + '/login') {
		return await login_endpoint(args)
	}
	// the auth endpoint is always mounted (default path when unconfigured) so
	// progressively-enhanced @session forms and useSession() work out of the box
	if (pathname.startsWith(authUrl)) {
		return await auth_endpoint(args)
	}
}

// sameOriginRefererPath returns the path+query of the request's Referer when it is same-origin, so
// it can be the default post-login landing (the page the user came from). Cross-origin or absent
// returns null, which safeRelative turns into '/'.
function sameOriginRefererPath(request: Request): string | null {
	const referer = request.headers.get('referer')
	if (!referer) {
		return null
	}
	try {
		const ref = new URL(referer)
		if (ref.origin !== new URL(request.url).origin) {
			return null
		}
		return ref.pathname + ref.search
	} catch {
		return null
	}
}

// oauthCallbackUrl is the single, fixed callback every provider redirects back to (the auth
// endpoint root). It's the registered `redirect_uri` — never derived from input. The callback reads
// which provider it is from the txn cookie, so one path serves every provider.
function oauthCallbackUrl(request: Request): string {
	return `${new URL(request.url).origin}${getAuthUrl()}`
}

// login_endpoint (`/login`) initiates a redirect login. It mints a single-use nonce, stores it (with
// the landing path) in a signed, browser-bound txn cookie, and redirects onward. Two flows share it:
// a configured first-class `provider` → Houdini runs the OAuth itself; otherwise an `auth.redirect`
// worker → Houdini delegates (the escape hatch). Mounted when either is configured.
async function login_endpoint(args: ServerHandlerArgs): Promise<Response | undefined> {
	const auth = args.server_config?.auth
	if (!auth?.redirect?.url && !auth?.providers) {
		return undefined
	}
	if (args.request.method !== 'GET') {
		return new Response('Method Not Allowed', { status: 405 })
	}
	const url = new URL(args.request.url)
	// when no explicit redirectTo is given, send the user back to the page they came from (the
	// same-origin Referer) — so a bare loginURL() returns them to where they were
	const redirectTo = safeRelative(
		url.searchParams.get('redirectTo') ?? sameOriginRefererPath(args.request)
	)

	// first-class OAuth: the requested provider is configured → Houdini runs the flow itself
	const requested = url.searchParams.get('provider')
	const provider = requested ? auth.providers?.[requested] : undefined
	if (provider) {
		return oauth_start(args, provider, requested!, redirectTo)
	}

	// otherwise fall to the escape hatch when a trusted worker is configured (it owns provider
	// selection); forward the app's params (minus our own redirectTo), add `state` + our callback
	// as `return`. `return` is OUR url (not app input); the integration must still allowlist it.
	if (auth.redirect?.url) {
		const nonce = randomToken()
		const target = new URL(auth.redirect.url)
		for (const [key, value] of url.searchParams) {
			if (key !== 'redirectTo') {
				target.searchParams.set(key, value)
			}
		}
		target.searchParams.set('state', nonce)
		target.searchParams.set('return', oauthCallbackUrl(args.request))
		const txn = await signRedirectTxn({ nonce, redirectTo }, args.session_keys)
		const response = new Response(null, {
			status: 302,
			headers: { Location: target.toString() },
		})
		response.headers.append('Set-Cookie', redirectTxnCookie(txn))
		return response
	}

	// only first-class providers are configured and the requested one is unknown (or none given)
	return new Response('Unknown provider', { status: 400 })
}

// oauth_start runs the first-class Authorization Code + PKCE start: mint state/nonce/PKCE (via
// oauth4webapi), stash the verifier+nonce+provider in the txn cookie, and 302 to the provider's
// authorize endpoint (resolved by discovery for OIDC providers).
async function oauth_start(
	args: ServerHandlerArgs,
	provider: OAuthProvider,
	providerName: string,
	redirectTo: string
): Promise<Response> {
	const as = await provider.server()
	const state = oauth.generateRandomState()
	const oidcNonce = provider.issuer ? oauth.generateRandomNonce() : undefined
	const codeVerifier = provider.pkce === 'S256' ? oauth.generateRandomCodeVerifier() : undefined

	const authorizeUrl = new URL(as.authorization_endpoint!)
	authorizeUrl.searchParams.set('client_id', provider.clientId)
	authorizeUrl.searchParams.set('redirect_uri', oauthCallbackUrl(args.request))
	authorizeUrl.searchParams.set('response_type', 'code')
	authorizeUrl.searchParams.set('scope', provider.scopes.join(' '))
	authorizeUrl.searchParams.set('state', state)
	if (codeVerifier) {
		authorizeUrl.searchParams.set(
			'code_challenge',
			await oauth.calculatePKCECodeChallenge(codeVerifier)
		)
		authorizeUrl.searchParams.set('code_challenge_method', 'S256')
	}
	if (oidcNonce) {
		authorizeUrl.searchParams.set('nonce', oidcNonce)
	}

	const txn = await signRedirectTxn(
		{ nonce: state, redirectTo, provider: providerName, codeVerifier, oidcNonce },
		args.session_keys
	)
	const response = new Response(null, {
		status: 302,
		headers: { Location: authorizeUrl.toString() },
	})
	response.headers.append('Set-Cookie', redirectTxnCookie(txn))
	return response
}

// oauth_callback completes a first-class flow with oauth4webapi: validate the callback params,
// exchange the code (code + PKCE verifier + client_secret over TLS), and — for OIDC providers —
// validate the id_token's SIGNATURE (against the issuer's JWKS) plus iss/aud/exp/nonce. Then
// normalize the user, hand it to onSignIn, and write the session. The txn nonce↔state check +
// cookie burn happen in the caller.
async function oauth_callback(
	args: ServerHandlerArgs,
	txn: RedirectTxn,
	searchParams: URLSearchParams
): Promise<Response> {
	const deny = () =>
		new Response('Forbidden', {
			status: 403,
			headers: { 'Set-Cookie': clearRedirectTxnCookie() },
		})

	const provider = args.server_config!.auth!.providers![txn.provider!]
	const as = await provider.server()
	const client: oauth.Client = { client_id: provider.clientId }
	const clientAuth = oauth.ClientSecretPost(provider.clientSecret)

	let result: oauth.TokenEndpointResponse
	try {
		// re-validate the callback (state must match the txn nonce; rejects provider error= responses)
		const params = oauth.validateAuthResponse(as, client, searchParams, txn.nonce)
		const tokenResponse = await oauth.authorizationCodeGrantRequest(
			as,
			client,
			clientAuth,
			params,
			oauthCallbackUrl(args.request),
			txn.codeVerifier ?? oauth.nopkce,
			{ [oauth.allowInsecureRequests]: Boolean(provider.allowInsecureRequests) }
		)
		result = await oauth.processAuthorizationCodeResponse(as, client, tokenResponse, {
			expectedNonce: txn.oidcNonce,
			requireIdToken: Boolean(provider.issuer),
			// permit the http JWKS fetch for local dev providers. The runtime reads this symbol (its
			// resolveEndpoint honors it), but oauth4webapi omits it from this options type, so cast.
			[oauth.allowInsecureRequests]: Boolean(provider.allowInsecureRequests),
		} as oauth.ProcessAuthorizationCodeResponseOptions)
	} catch {
		return deny()
	}

	const tokens: OAuthTokens = {
		accessToken: result.access_token,
		refreshToken: result.refresh_token,
		expiresAt:
			typeof result.expires_in === 'number'
				? Math.floor(Date.now() / 1000) + result.expires_in
				: undefined,
		scope: result.scope,
		idToken: result.id_token,
	}
	const claims = oauth.getValidatedIdTokenClaims(result)
	const user = await provider.user({ tokens, claims })
	const onSignIn = args.server_config?.auth?.onSignIn
	const session = onSignIn ? await onSignIn({ provider: txn.provider!, user, tokens }) : {}

	const response = new Response('ok', { status: 302, headers: { Location: txn.redirectTo } })
	await set_session(args, response, (session ?? {}) as App.Session)
	response.headers.append('Set-Cookie', clearRedirectTxnCookie())
	return response
}

// the always-on session endpoint. GET sets the session from query params and redirects (an
// external redirect-based / OAuth-callback flow); POST sets it from either a server-signed
// session-mint token (the @session enhanced path — server-authoritative) or, for
// same-origin app code (useSession's updateSession), a raw values body.
async function auth_endpoint(args: ServerHandlerArgs): Promise<Response | undefined> {
	// GET: the redirect-login callback. Mounted when a redirect integration OR first-class providers
	// are configured. It requires the browser-bound nonce set at /login, then either completes a
	// first-class OAuth flow itself (token exchange + id_token) or accepts a worker-signed token —
	// so a valid completion can't be injected into a different browser.
	if (args.request.method === 'GET') {
		const auth = args.server_config?.auth
		if (!auth?.redirect?.url && !auth?.providers) {
			return undefined
		}
		const { searchParams } = new URL(
			args.request.url!,
			`http://${args.request.headers.get('host')}`
		)

		// browser binding: the txn cookie set at /login must match the `state` echoed back. This ties
		// the round-trip to the browser that started it — the fix for the session fixation the
		// constant anonymous `sid` couldn't prevent. redirectTo comes from the signed cookie (set at
		// /login), never the query string, so there's no open-redirect sink.
		const cookies = parse(args.request.headers.get('cookie') ?? '')
		const txn = await verifyRedirectTxn(cookies[REDIRECT_TXN_COOKIE], args.session_keys)
		const state = searchParams.get('state')
		if (!txn || !state || !timingSafeEqual(txn.nonce, state)) {
			return new Response('Forbidden', {
				status: 403,
				headers: { 'Set-Cookie': clearRedirectTxnCookie() },
			})
		}

		// first-class OAuth: Houdini exchanges the code + establishes the session itself
		if (txn.provider && auth.providers?.[txn.provider]) {
			return oauth_callback(args, txn, searchParams)
		}

		// escape hatch: accept the worker-signed session-mint token relayed in the query
		const response = new Response('ok', { status: 302, headers: { Location: txn.redirectTo } })
		const applied = await applySessionToken(args, response, searchParams.get('token'))
		// single-use: burn the nonce on every outcome. Append AFTER applySessionToken's Set-Cookie
		// (.set) so the session cookie isn't clobbered.
		const result = applied ? response : new Response('Forbidden', { status: 403 })
		result.headers.append('Set-Cookie', clearRedirectTxnCookie())
		return result
	}

	if (args.request.method === 'POST') {
		// fail-closed on the Origin header — a cross-origin page can't forge a session write
		const origin = args.request.headers.get('origin')
		const allowedOrigins = [
			new URL(args.request.url).origin,
			...(args.server_config?.allowedOrigins ?? []),
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

// sign_session produces the signed session-cookie VALUE for a known session. It exists so the
// in-process GraphQL proxy can hand a TRUSTED session to the local handler, which reads the session
// via get_session (a signed-JWT verify) and would otherwise reject a raw JSON cookie and fall back
// to an empty session. No exp: the cookie is minted and consumed within the same in-process call.
export async function sign_session(session: App.Session, key: string): Promise<string> {
	return encode({ ...session }, key)
}

export async function set_session(req: ServerHandlerArgs, response: Response, value: App.Session) {
	const today = new Date()
	const expires = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000) // Add 7 days in milliseconds

	// serialize the value, stamping `exp` so the SIGNED token expires server-side too — not just the
	// browser cookie. Without it a captured cookie would verify forever (until a global key rotation);
	// with it, a stolen cookie value is unusable past `expires`. get_session strips exp/iat back out.
	const serialized = await encode(
		{ ...value, exp: Math.floor(expires.getTime() / 1000) },
		req.session_keys[0]
	)

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
			// check if its valid (verify also fails closed on an expired `exp`, so a stolen cookie
			// stops working server-side once it passes the 7-day mark)
			if (!(await verify(cookie, secret))) {
				continue
			}

			// parse the cookie header
			const parsed = decode(cookie)
			if (!parsed) {
				return {}
			}

			// strip the JWT reserved claims we stamp on (exp/iat) so they don't leak into the
			// app-visible session object
			const { exp: _exp, iat: _iat, ...session } = parsed.payload
			return session as App.Session
		} catch {
			continue
		}
	}

	// if we got this far then the cookie value didn't match any of the available secrets
	return {}
}
