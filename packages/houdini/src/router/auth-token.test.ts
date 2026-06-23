import { test, expect, describe } from 'vitest'

import { signSessionToken, verifySessionToken, signFormToken, verifyFormToken } from './auth-token.js'

const keys = ['test-secret']

describe('session-mint token', () => {
	test('round-trips the signed session payload as a set action', async () => {
		const token = await signSessionToken({ userId: '7', token: 'abc' } as any, keys)
		expect(await verifySessionToken(token, keys)).toEqual({
			session: { userId: '7', token: 'abc' },
		})
	})

	test('a null payload encodes a clear (logout) action', async () => {
		const token = await signSessionToken(null, keys)
		expect(await verifySessionToken(token, keys)).toEqual({ clear: true })
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
