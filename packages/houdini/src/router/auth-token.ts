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
		if (!payload || payload.houdiniForm !== true) {
			return false
		}
		return payload.sid === (await sessionFingerprint(session, key))
	} catch {
		return false
	}
}

// the verified outcome of a session-mint token: replace the session with `session`, or clear
// it. (A null verify result — distinct from this — means the token was invalid.)
export type SessionTokenResult = { session: App.Session } | { clear: true }

// signSessionToken mints the server-authoritative session token for the enhanced (post-
// hydration) @auth path. A non-null payload replaces the session; a null payload encodes a
// clear (logout). Signed with the session-mint key so the client can relay but never forge it.
export async function signSessionToken(
	payload: App.Session | null,
	sessionKeys: string[]
): Promise<string> {
	const claims =
		payload == null
			? { houdiniSession: true, clear: true }
			: { houdiniSession: true, payload }
	return encodeJWT(
		{ ...claims, exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS },
		sessionTokenKey(sessionKeys)
	)
}

// verifySessionToken checks a relayed session-mint token. It returns the intended action
// (replace with a session, or clear) when valid, or null when the token is invalid. The
// payload is trustworthy because only the server holds the signing key, so a client cannot
// tamper with what becomes the session.
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
		if (payload.clear === true) {
			return { clear: true }
		}
		return { session: (payload.payload ?? {}) as App.Session }
	} catch {
		return null
	}
}
