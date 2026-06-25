import { encode as encodeJWT, verify as verifyJWT, decode as decodeJWT } from './jwt.js'

// Token crypto shared by the form handler (server.ts) and the auth endpoint (session.ts).
// Lives in its own module because server.ts imports get_session/set_session from session.ts,
// so the tokens can't live in server.ts without a cycle.

// the hidden field carrying the CSRF token on a form / the key in the updateSession body.
export const CSRF_FIELD = '__houdini_csrf'
// how long a rendered form's CSRF token stays valid (seconds)
const CSRF_TTL_SECONDS = 60 * 60 * 2
// a session-mint token only has to survive a GraphQL response → immediate POST round-trip.
const SESSION_TTL_SECONDS = 60

// formTokenKey derives the CSRF-token signing key, domain-separated from the session-cookie
// key so a session cookie can never be presented as a CSRF token, and vice versa.
function formTokenKey(sessionKeys: string[]): string {
	return sessionKeys[0] + '|houdini-form-csrf'
}

// sessionTokenKey derives the session-mint signing key — domain-separated from BOTH the
// session-cookie key and the CSRF-token key, so none of the three can be cross-presented.
function sessionTokenKey(sessionKeys: string[]): string {
	return sessionKeys[0] + '|houdini-session-mint'
}

// redirectTxnKey derives the signing key for the redirect-login transaction cookie — domain-
// separated from the other three so a txn cookie can't be presented as a session/CSRF/mint token
// or vice versa.
function redirectTxnKey(sessionKeys: string[]): string {
	return sessionKeys[0] + '|houdini-redirect-txn'
}

// how long a redirect-login transaction stays valid (seconds): long enough to complete the
// provider's login, short enough to bound replay of a leaked cookie. Exported so the txn cookie's
// Max-Age (session.ts) is driven by the same value as the signed JWT's exp — they can't diverge.
export const REDIRECT_TXN_TTL_SECONDS = 60 * 10

// timingSafeEqual compares two strings in constant time (relative to length), so a `===` on a
// secret-derived value (token fingerprint / nonce) doesn't leak a prefix match through timing. Used
// as defense-in-depth: every caller already gates this behind a constant-time signature verify.
export function timingSafeEqual(a: string, b: string): boolean {
	if (a.length !== b.length) {
		return false
	}
	let mismatch = 0
	for (let i = 0; i < a.length; i++) {
		mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i)
	}
	return mismatch === 0
}

// stableStringify serializes with sorted keys so a session fingerprint is deterministic
// across the render and the submit.
function stableStringify(value: any): string {
	if (value && typeof value === 'object' && !Array.isArray(value)) {
		return (
			'{' +
			Object.keys(value)
				.sort()
				.map((k) => JSON.stringify(k) + ':' + stableStringify(value[k]))
				.join(',') +
			'}'
		)
	}
	return JSON.stringify(value ?? null)
}

// sessionFingerprint is a keyed (HMAC) hash of the session — it binds a token to a specific
// session without leaking the session contents into the rendered page (token payload is
// readable base64).
async function sessionFingerprint(session: App.Session, key: string): Promise<string> {
	const enc = new TextEncoder()
	const cryptoKey = await crypto.subtle.importKey(
		'raw',
		enc.encode(key),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign']
	)
	const sig = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(stableStringify(session)))
	return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

// signFormToken mints the CSRF token a form renders: a JWT bound to the current session,
// time-limited, carrying a purpose claim, signed with the domain-separated form key.
// Exported so tests mint tokens through the real path.
export async function signFormToken(session: App.Session, sessionKeys: string[]): Promise<string> {
	const key = formTokenKey(sessionKeys)
	const sid = await sessionFingerprint(session, key)
	return encodeJWT(
		{ houdiniForm: true, sid, exp: Math.floor(Date.now() / 1000) + CSRF_TTL_SECONDS },
		key
	)
}

// verifyFormToken checks the token submitted with a form/updateSession: valid signature, not
// expired, carries the purpose claim, and is bound to *this* request's session.
export async function verifyFormToken(
	token: unknown,
	session: App.Session,
	sessionKeys: string[]
): Promise<boolean> {
	if (typeof token !== 'string') {
		return false
	}
	const key = formTokenKey(sessionKeys)
	try {
		if (!(await verifyJWT(token, key))) {
			return false
		}
		const payload = decodeJWT(token).payload as any
		if (!payload || payload.houdiniForm !== true || typeof payload.sid !== 'string') {
			return false
		}
		return timingSafeEqual(payload.sid, await sessionFingerprint(session, key))
	} catch {
		return false
	}
}

// the contents of the redirect-login transaction cookie: a single-use `nonce` (handed to the
// trusted integration / OAuth provider as `state` and echoed back, so the round-trip is bound to
// the browser that started it) and the post-login landing path (kept server-side in the signed
// cookie so it never rides the open wire where it could be turned into an open redirect).
export type RedirectTxn = {
	nonce: string
	redirectTo: string
	// — first-class OAuth only (absent for the escape-hatch flow) —
	// which configured provider this flow is for; the callback reads it to pick the token endpoint
	provider?: string
	// the PKCE code_verifier (its S256 challenge went to the provider's authorize endpoint)
	codeVerifier?: string
	// the OIDC nonce sent to the provider; must equal id_token.nonce at the callback
	oidcNonce?: string
}

// signRedirectTxn mints the transaction cookie set when a redirect login is initiated (/login).
// Signed with the domain-separated redirect key and short-lived.
export async function signRedirectTxn(txn: RedirectTxn, sessionKeys: string[]): Promise<string> {
	return encodeJWT(
		{
			houdiniRedirect: true,
			...txn,
			exp: Math.floor(Date.now() / 1000) + REDIRECT_TXN_TTL_SECONDS,
		},
		redirectTxnKey(sessionKeys)
	)
}

// verifyRedirectTxn checks the transaction cookie presented at the callback: valid signature, not
// expired, carries the purpose claim. Returns the nonce + landing path, or null on any failure.
export async function verifyRedirectTxn(
	cookie: unknown,
	sessionKeys: string[]
): Promise<RedirectTxn | null> {
	if (typeof cookie !== 'string') {
		return null
	}
	try {
		if (!(await verifyJWT(cookie, redirectTxnKey(sessionKeys)))) {
			return null
		}
		const payload = decodeJWT(cookie).payload as any
		if (!payload || payload.houdiniRedirect !== true) {
			return null
		}
		if (typeof payload.nonce !== 'string' || typeof payload.redirectTo !== 'string') {
			return null
		}
		const txn: RedirectTxn = { nonce: payload.nonce, redirectTo: payload.redirectTo }
		// pass through the OAuth fields when present (the escape-hatch flow omits them)
		if (typeof payload.provider === 'string') txn.provider = payload.provider
		if (typeof payload.codeVerifier === 'string') txn.codeVerifier = payload.codeVerifier
		if (typeof payload.oidcNonce === 'string') txn.oidcNonce = payload.oidcNonce
		return txn
	} catch {
		return null
	}
}

// base64url-encodes bytes without padding (RFC 4648 §5) — the encoding PKCE and OAuth state/nonce
// values use.
function base64url(bytes: Uint8Array): string {
	let binary = ''
	for (const byte of bytes) {
		binary += String.fromCharCode(byte)
	}
	return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

// randomToken returns a URL-safe random string (default 32 bytes of entropy) — used for the
// escape-hatch redirect nonce. (First-class OAuth's state/nonce/PKCE come from oauth4webapi.)
export function randomToken(bytes = 32): string {
	return base64url(crypto.getRandomValues(new Uint8Array(bytes)))
}

// the verified outcome of a session-mint token: write `session` (merge into the existing
// session when `merge`, else replace it), or clear it. Every result also carries the `sid`
// (the fingerprint of the session the token was minted under) and a unique `jti`, so the sink
// can bind the token to the presenting session and reject replays. (A null verify result —
// distinct from this — means the token was invalid.)
type SessionAction = { session: App.Session; merge: boolean } | { clear: true }
export type SessionTokenResult = SessionAction & { sid: string; jti: string }

// sessionTokenFingerprint binds a mint token to a specific session, using the domain-separated
// session-mint key. Exported so the auth endpoint can check a relayed token against the
// session that is presenting it.
export function sessionTokenFingerprint(
	session: App.Session,
	sessionKeys: string[]
): Promise<string> {
	return sessionFingerprint(session, sessionTokenKey(sessionKeys))
}

// signSessionToken mints the server-authoritative session token for the enhanced (post-
// hydration) @session path. A non-null payload writes the session (merging when `merge`); a
// null payload encodes a clear (logout). Signed with the session-mint key so the client can
// relay but never forge it. The token is bound to `priorSession` (the session the mutation ran
// under) via `sid` and carries a unique `jti` so the auth endpoint can reject a relay from a
// different session or a replay of an already-consumed token.
export async function signSessionToken(
	payload: App.Session | null,
	sessionKeys: string[],
	merge = false,
	priorSession: App.Session = {}
): Promise<string> {
	const claims =
		payload == null
			? { houdiniSession: true, clear: true }
			: { houdiniSession: true, payload, merge }
	return encodeJWT(
		{
			...claims,
			sid: await sessionTokenFingerprint(priorSession, sessionKeys),
			jti: crypto.randomUUID(),
			exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
		},
		sessionTokenKey(sessionKeys)
	)
}

// verifySessionToken checks a relayed session-mint token. It returns the intended action
// (write the session — merge or replace — or clear) plus the token's `sid`/`jti` when valid,
// or null when the token is invalid. The payload is trustworthy because only the server holds
// the signing key; the caller must still check `sid` against the presenting session and that
// `jti` has not been consumed.
export async function verifySessionToken(
	token: unknown,
	sessionKeys: string[]
): Promise<SessionTokenResult | null> {
	if (typeof token !== 'string') {
		return null
	}
	try {
		if (!(await verifyJWT(token, sessionTokenKey(sessionKeys)))) {
			return null
		}
		const payload = decodeJWT(token).payload as any
		if (!payload || payload.houdiniSession !== true) {
			return null
		}
		if (typeof payload.sid !== 'string' || typeof payload.jti !== 'string') {
			return null
		}
		const binding = { sid: payload.sid as string, jti: payload.jti as string }
		if (payload.clear === true) {
			return { clear: true, ...binding }
		}
		return {
			session: (payload.payload ?? {}) as App.Session,
			merge: payload.merge === true,
			...binding,
		}
	} catch {
		return null
	}
}
