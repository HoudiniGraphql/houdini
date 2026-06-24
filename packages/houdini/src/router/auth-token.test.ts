import { test, expect, describe } from 'vitest'

import {
	signSessionToken,
	verifySessionToken,
	sessionTokenFingerprint,
	signFormToken,
	verifyFormToken,
	signRedirectTxn,
	verifyRedirectTxn,
	randomToken,
	timingSafeEqual,
} from './auth-token.js'

const keys = ['test-secret']

describe('timingSafeEqual', () => {
	test('true only for identical strings', () => {
		expect(timingSafeEqual('abcdef', 'abcdef')).toBe(true)
		expect(timingSafeEqual('abcdef', 'abcdeg')).toBe(false)
		expect(timingSafeEqual('abc', 'abcd')).toBe(false) // different length
		expect(timingSafeEqual('', '')).toBe(true)
	})
})

describe('session-mint token', () => {
	test('round-trips the signed session payload as a replace action', async () => {
		const token = await signSessionToken({ userId: '7', token: 'abc' } as any, keys)
		expect(await verifySessionToken(token, keys)).toMatchObject({
			session: { userId: '7', token: 'abc' },
			merge: false,
		})
	})

	test('a merge token round-trips with merge: true', async () => {
		const token = await signSessionToken({ theme: 'dark' } as any, keys, true)
		expect(await verifySessionToken(token, keys)).toMatchObject({
			session: { theme: 'dark' },
			merge: true,
		})
	})

	test('a null payload encodes a clear (logout) action', async () => {
		const token = await signSessionToken(null, keys)
		expect(await verifySessionToken(token, keys)).toMatchObject({ clear: true })
	})

	test('binds sid to the prior session and carries a unique jti', async () => {
		const prior = { userId: '7' } as any
		const a = await verifySessionToken(
			await signSessionToken({ x: 1 } as any, keys, false, prior),
			keys
		)
		const b = await verifySessionToken(
			await signSessionToken({ x: 2 } as any, keys, false, prior),
			keys
		)
		const other = await verifySessionToken(
			await signSessionToken({ x: 3 } as any, keys, false, { userId: '8' } as any),
			keys
		)
		// sid is the keyed fingerprint of the prior session: stable for the same session...
		expect(a!.sid).toBe(await sessionTokenFingerprint(prior, keys))
		expect(a!.sid).toBe(b!.sid)
		// ...and different for a different session, so a leaked token can't be replayed elsewhere
		expect(other!.sid).not.toBe(a!.sid)
		// jti is unique per mint, so a token can be single-used
		expect(a!.jti).not.toBe(b!.jti)
	})

	test('rejects a garbage / non-string token', async () => {
		expect(await verifySessionToken('not.a.token', keys)).toBe(null)
		expect(await verifySessionToken(undefined, keys)).toBe(null)
	})

	test('rejects a token signed with a different key', async () => {
		const token = await signSessionToken({ userId: '7' } as any, ['other-key'])
		expect(await verifySessionToken(token, keys)).toBe(null)
	})

	// the three token purposes share sessionKeys[0] but are domain-separated; none may be
	// presented as another, or a CSRF token could be replayed to mint a session and vice versa.
	test('a form CSRF token does not verify as a session token', async () => {
		const formTok = await signFormToken({} as any, keys)
		expect(await verifySessionToken(formTok, keys)).toBe(null)
	})

	test('a session token does not verify as a form CSRF token', async () => {
		const sessionTok = await signSessionToken({ userId: '7' } as any, keys)
		expect(await verifyFormToken(sessionTok, {} as any, keys)).toBe(false)
	})
})

describe('redirect-login transaction cookie', () => {
	test('round-trips the nonce and landing path', async () => {
		const cookie = await signRedirectTxn({ nonce: 'n1', redirectTo: '/home' }, keys)
		expect(await verifyRedirectTxn(cookie, keys)).toEqual({ nonce: 'n1', redirectTo: '/home' })
	})

	test('round-trips the first-class OAuth fields (provider, codeVerifier, oidcNonce)', async () => {
		const cookie = await signRedirectTxn(
			{
				nonce: 'n',
				redirectTo: '/d',
				provider: 'github',
				codeVerifier: 'v',
				oidcNonce: 'on',
			},
			keys
		)
		expect(await verifyRedirectTxn(cookie, keys)).toEqual({
			nonce: 'n',
			redirectTo: '/d',
			provider: 'github',
			codeVerifier: 'v',
			oidcNonce: 'on',
		})
	})

	test('rejects a garbage cookie or non-string', async () => {
		expect(await verifyRedirectTxn('not.a.jwt', keys)).toBe(null)
		expect(await verifyRedirectTxn(undefined, keys)).toBe(null)
	})

	test('rejects a cookie signed with a different key', async () => {
		const cookie = await signRedirectTxn({ nonce: 'n', redirectTo: '/' }, ['other-key'])
		expect(await verifyRedirectTxn(cookie, keys)).toBe(null)
	})

	// the four token purposes share sessionKeys[0] but are domain-separated; a leaked txn cookie
	// must not be replayable as a session/CSRF token, and neither of those as a txn cookie.
	test('does not cross-verify with the session or form token purposes', async () => {
		const txn = await signRedirectTxn({ nonce: 'n', redirectTo: '/' }, keys)
		expect(await verifySessionToken(txn, keys)).toBe(null)
		expect(await verifyFormToken(txn, {} as any, keys)).toBe(false)

		const sessionTok = await signSessionToken({ userId: '7' } as any, keys)
		expect(await verifyRedirectTxn(sessionTok, keys)).toBe(null)
		const formTok = await signFormToken({} as any, keys)
		expect(await verifyRedirectTxn(formTok, keys)).toBe(null)
	})
})

describe('random tokens', () => {
	test('randomToken is url-safe and unique per call', () => {
		const a = randomToken()
		const b = randomToken()
		expect(a).not.toBe(b)
		expect(a).toMatch(/^[A-Za-z0-9_-]+$/)
	})
})
