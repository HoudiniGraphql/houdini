import { test, expect, describe, vi, afterEach } from 'vitest'

import { github, oidc } from './index.js'

afterEach(() => {
	vi.unstubAllGlobals()
})

describe('github provider', () => {
	test('static authorization server + S256 PKCE + default scopes, no issuer marker', async () => {
		const p = github({ clientId: 'id', clientSecret: 'secret' })
		expect(p.pkce).toBe('S256')
		expect(p.issuer).toBeUndefined()
		expect(p.scopes).toEqual(['read:user', 'user:email'])
		expect(await p.server()).toMatchObject({
			issuer: 'https://github.com',
			authorization_endpoint: 'https://github.com/login/oauth/authorize',
			token_endpoint: 'https://github.com/login/oauth/access_token',
		})
	})

	test('user fetches /user + /user/emails and picks the primary verified email', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async (url: string) =>
				url.endsWith('/user')
					? new Response(
							JSON.stringify({ id: 7, login: 'alec', name: 'Alec', avatar_url: 'a' })
						)
					: new Response(
							JSON.stringify([
								{ email: 'secondary@x.com', primary: false, verified: true },
								{ email: 'alec@x.com', primary: true, verified: true },
							])
						)
			)
		)
		const p = github({ clientId: 'id', clientSecret: 'secret' })
		const user = await p.user({ tokens: { accessToken: 'tok' } })
		expect(user).toMatchObject({
			sub: '7',
			email: 'alec@x.com',
			emailVerified: true,
			name: 'Alec',
			login: 'alec',
		})
	})

	test('omits the email when no primary verified one exists (no unverified fallback)', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async (url: string) =>
				url.endsWith('/user')
					? // /user.email is set but its verification status is unknown — must NOT be trusted
						new Response(
							JSON.stringify({ id: 7, login: 'alec', email: 'public@x.com' })
						)
					: new Response(
							JSON.stringify([
								{ email: 'unverified@x.com', primary: true, verified: false },
								{
									email: 'verified-but-secondary@x.com',
									primary: false,
									verified: true,
								},
							])
						)
			)
		)
		const p = github({ clientId: 'id', clientSecret: 'secret' })
		const user = await p.user({ tokens: { accessToken: 'tok' } })
		// no primary+verified email → email omitted entirely; identity rests on sub
		expect(user.sub).toBe('7')
		expect(user.email).toBeUndefined()
		expect(user.emailVerified).toBeUndefined()
	})

	test('throws on a non-2xx /user response (no sub="undefined" account collapse)', async () => {
		// a rate-limited / revoked-token /user returns a JSON error body with no id — must not
		// resolve to sub="undefined" (which would key every failed login to the same account)
		vi.stubGlobal(
			'fetch',
			vi.fn(async (url: string) =>
				url.endsWith('/user')
					? new Response(JSON.stringify({ message: 'API rate limit exceeded' }), {
							status: 403,
						})
					: new Response(JSON.stringify([]))
			)
		)
		const p = github({ clientId: 'id', clientSecret: 'secret' })
		await expect(p.user({ tokens: { accessToken: 'tok' } })).rejects.toThrow(/github \/user/)
	})
})

describe('oidc provider', () => {
	test('discovers the authorization server from the issuer and memoizes', async () => {
		const fetchMock = vi.fn(
			async () =>
				new Response(
					JSON.stringify({
						issuer: 'https://issuer.test',
						authorization_endpoint: 'https://issuer.test/authorize',
						token_endpoint: 'https://issuer.test/token',
						jwks_uri: 'https://issuer.test/jwks',
					}),
					{ headers: { 'content-type': 'application/json' } }
				)
		)
		vi.stubGlobal('fetch', fetchMock)

		const p = oidc({ issuer: 'https://issuer.test', clientId: 'id', clientSecret: 'secret' })
		expect(p.issuer).toBe('https://issuer.test')
		expect(p.scopes).toEqual(['openid', 'email', 'profile'])
		const as = await p.server()
		expect(as.authorization_endpoint).toBe('https://issuer.test/authorize')
		expect(as.token_endpoint).toBe('https://issuer.test/token')
		// second resolve uses the cached discovery, no re-fetch
		await p.server()
		expect(fetchMock).toHaveBeenCalledTimes(1)
	})

	test('a failed discovery is not memoized — the next call retries', async () => {
		let calls = 0
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => {
				calls++
				if (calls === 1) {
					throw new Error('transient network failure')
				}
				return new Response(
					JSON.stringify({
						issuer: 'https://issuer.test',
						authorization_endpoint: 'https://issuer.test/authorize',
						token_endpoint: 'https://issuer.test/token',
						jwks_uri: 'https://issuer.test/jwks',
					}),
					{ headers: { 'content-type': 'application/json' } }
				)
			})
		)
		const p = oidc({ issuer: 'https://issuer.test', clientId: 'id', clientSecret: 'secret' })
		await expect(p.server()).rejects.toThrow() // first discovery fails
		const as = await p.server() // must retry, not return the cached rejection
		expect(as.token_endpoint).toBe('https://issuer.test/token')
		expect(calls).toBe(2)
	})

	test('user reads the validated id_token claims', () => {
		const p = oidc({ issuer: 'https://issuer.test', clientId: 'id', clientSecret: 'secret' })
		expect(
			p.user({
				tokens: { accessToken: 'tok' },
				claims: {
					iss: 'https://issuer.test',
					aud: 'id',
					sub: 'u1',
					exp: 0,
					email: 'a@x.com',
					email_verified: true,
					name: 'A',
				} as any,
			})
		).toEqual({ sub: 'u1', email: 'a@x.com', emailVerified: true, name: 'A' })
	})

	test('drops an unverified email (email_verified false)', () => {
		const p = oidc({ issuer: 'https://issuer.test', clientId: 'id', clientSecret: 'secret' })
		const user = p.user({
			tokens: { accessToken: 'tok' },
			claims: { sub: 'u1', email: 'a@x.com', email_verified: false, name: 'A' } as any,
		})
		expect(user).toEqual({ sub: 'u1', email: undefined, emailVerified: undefined, name: 'A' })
	})

	test('drops an email when email_verified is absent (absence is not verification)', async () => {
		const p = oidc({ issuer: 'https://issuer.test', clientId: 'id', clientSecret: 'secret' })
		const user = await p.user({
			tokens: { accessToken: 'tok' },
			claims: { sub: 'u1', email: 'a@x.com', name: 'A' } as any,
		})
		expect(user.email).toBeUndefined()
		expect(user.emailVerified).toBeUndefined()
	})

	test('no email in the payload is fine — identity rests on sub', () => {
		const p = oidc({ issuer: 'https://issuer.test', clientId: 'id', clientSecret: 'secret' })
		const user = p.user({
			tokens: { accessToken: 'tok' },
			claims: { sub: 'u1', name: 'A' } as any,
		})
		expect(user).toEqual({ sub: 'u1', email: undefined, emailVerified: undefined, name: 'A' })
	})

	test('user requires an id_token', () => {
		const p = oidc({ issuer: 'https://issuer.test', clientId: 'id', clientSecret: 'secret' })
		expect(() => p.user({ tokens: { accessToken: 'tok' } })).toThrow(/id_token/)
	})
})

describe('allowInsecureRequests gating', () => {
	test('honored for a loopback issuer (local dev)', () => {
		const p = oidc({
			issuer: 'http://localhost:8081',
			clientId: 'id',
			clientSecret: 's',
			allowInsecureRequests: true,
		})
		expect(p.allowInsecureRequests).toBe(true)
	})

	test('dropped (with a warning) for a non-loopback issuer — no cleartext in prod', () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
		const p = oidc({
			issuer: 'http://issuer.example.com',
			clientId: 'id',
			clientSecret: 's',
			allowInsecureRequests: true,
		})
		expect(p.allowInsecureRequests).toBe(false)
		expect(warn).toHaveBeenCalled()
		warn.mockRestore()
	})

	test('github never enables insecure (its endpoints are https)', () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
		const p = github({ clientId: 'id', clientSecret: 's', allowInsecureRequests: true })
		expect(p.allowInsecureRequests).toBe(false)
		warn.mockRestore()
	})
})
