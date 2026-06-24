import * as oauth from 'oauth4webapi'

// houdini/oauth — provider adapters for the first-class OAuth login flow. Import the provider you
// need and configure it with your client credentials in src/server/+config:
//
//   import { github, oidc } from 'houdini/oauth'
//   providers: { github: github({ clientId, clientSecret }) }
//
// The Authorization Code + PKCE flow, discovery, and id_token validation (signature + claims) are
// handled by oauth4webapi; each factory returns the provider metadata + a user mapper. This
// module is server-only (it holds the client secret) and is imported from src/server/+config.

// the normalized user the adapter hands to onSignIn (provider-shaped extras kept too)
export type OAuthUser = {
	// a stable, provider-unique user id
	sub: string
	email?: string
	emailVerified?: boolean
	name?: string
	[key: string]: unknown
}

// the tokens returned by the provider's token endpoint
export type OAuthTokens = {
	accessToken: string
	refreshToken?: string
	// epoch seconds the access token expires at, when the provider reports expires_in
	expiresAt?: number
	scope?: string
	// the raw id_token (OIDC providers only)
	idToken?: string
}

// the validated id_token claims (OIDC providers) — oauth4webapi has already checked the signature
// against the issuer's JWKS plus iss/aud/exp/nonce by the time these reach a provider's user().
export type IdTokenClaims = oauth.IDToken

// the authorization-server metadata oauth4webapi drives the flow with
export type AuthorizationServer = oauth.AuthorizationServer

// an OAuth provider adapter: the per-provider behavior bound to the app's client credentials.
export type OAuthProvider = {
	clientId: string
	clientSecret: string
	scopes: string[]
	// PKCE method, or false to disable (rare — only for providers that don't support it)
	pkce: 'S256' | false
	// set for OIDC providers — when present the callback requires and validates an id_token
	issuer?: string
	// allow http (not https) for the provider's endpoints. Only ever honored for LOOPBACK issuers
	// (localhost / 127.0.0.1 / ::1) — the factories drop it for any other host, so it cannot enable
	// a cleartext flow in production. Set by the factories, not by hand.
	allowInsecureRequests?: boolean
	// resolve the authorization-server metadata (discovery for OIDC, static otherwise). Memoized by
	// the factory so discovery runs at most once.
	server: () => Promise<AuthorizationServer>
	// map the token response (+ validated id_token claims for OIDC) to the normalized user
	user: (args: {
		tokens: OAuthTokens
		claims?: IdTokenClaims
	}) => Promise<OAuthUser> | OAuthUser
}

export type OAuthProviderConfig = {
	clientId: string
	clientSecret: string
	scopes?: string[]
	// local-development only: permit http endpoints. Honored ONLY for a loopback issuer; ignored
	// (with a warning) for any other host, so it can't enable a cleartext flow in production.
	allowInsecureRequests?: boolean
}

// a host is loopback when it can only be reached from the same machine — the one case where http is
// not a network-exposed MITM risk. Used to gate `allowInsecureRequests` to local development.
function isLoopbackHost(host: string): boolean {
	return (
		host === 'localhost' ||
		host === '127.0.0.1' ||
		host === '::1' ||
		host === '[::1]' ||
		host.endsWith('.localhost')
	)
}

// insecureGate returns the effective allowInsecureRequests: the requested value, but only when
// `url` is a loopback http endpoint. Anything else drops the flag (and warns) so a misconfiguration
// can never permit cleartext discovery/token/JWKS against a real provider.
function insecureGate(requested: boolean | undefined, url: string): boolean {
	if (!requested) {
		return false
	}
	let host = ''
	try {
		host = new URL(url).hostname
	} catch {
		return false
	}
	if (isLoopbackHost(host)) {
		return true
	}
	console.warn(
		`[houdini] ignoring allowInsecureRequests for non-loopback OAuth host "${host}" — http is only permitted for local development`
	)
	return false
}

// github is a non-OIDC provider: static endpoints, identity fetched from the REST API. It supports
// PKCE (since 2025) but returns no id_token, so the user comes from /user + /user/emails.
export function github(config: OAuthProviderConfig): OAuthProvider {
	const as: AuthorizationServer = {
		issuer: 'https://github.com',
		authorization_endpoint: 'https://github.com/login/oauth/authorize',
		token_endpoint: 'https://github.com/login/oauth/access_token',
	}
	return {
		clientId: config.clientId,
		clientSecret: config.clientSecret,
		scopes: config.scopes ?? ['read:user', 'user:email'],
		pkce: 'S256',
		allowInsecureRequests: insecureGate(config.allowInsecureRequests, as.token_endpoint!),
		// no `issuer` → non-OIDC: no id_token to validate, the user comes from the REST API
		server: async () => as,
		user: async ({ tokens }) => {
			const headers = {
				Authorization: `Bearer ${tokens.accessToken}`,
				Accept: 'application/vnd.github+json',
				'User-Agent': 'houdini',
			}
			const [user, emails] = await Promise.all([
				fetch('https://api.github.com/user', { headers }).then((r) => r.json()),
				fetch('https://api.github.com/user/emails', { headers })
					.then((r) => r.json())
					.catch(() => []),
			])
			// only trust a primary AND verified email. An unverified address (or /user.email,
			// whose verification status this API doesn't report) could belong to someone else, so
			// using it to key/link accounts is an account-takeover vector. No verified email →
			// omit it entirely; identity still rests on `sub`.
			const verifiedEmail = Array.isArray(emails)
				? emails.find((e: any) => e.primary && e.verified)?.email
				: undefined
			return {
				sub: String(user.id),
				email: verifiedEmail,
				emailVerified: verifiedEmail ? true : undefined,
				name: user.name ?? user.login,
				login: user.login,
				avatarUrl: user.avatar_url,
			}
		},
	}
}

export type OIDCProviderConfig = OAuthProviderConfig & {
	// the OIDC issuer; endpoints + the signing JWKS are discovered from
	// <issuer>/.well-known/openid-configuration
	issuer: string
}

// oidc is the generic OpenID Connect provider — it discovers the authorization server (endpoints +
// jwks) from the issuer and reads the user from the validated id_token claims. Covers Google,
// Microsoft, Auth0, Okta, Apple, … config-only: oidc({ issuer, clientId, clientSecret }).
export function oidc(config: OIDCProviderConfig): OAuthProvider {
	let cache: Promise<AuthorizationServer> | null = null
	const issuerUrl = new URL(config.issuer)
	// http is permitted only against a loopback issuer (local dev); dropped for any real provider
	const allowInsecure = insecureGate(config.allowInsecureRequests, config.issuer)
	return {
		clientId: config.clientId,
		clientSecret: config.clientSecret,
		scopes: config.scopes ?? ['openid', 'email', 'profile'],
		pkce: 'S256',
		issuer: config.issuer,
		allowInsecureRequests: allowInsecure,
		server: () => {
			if (!cache) {
				cache = oauth
					.discoveryRequest(issuerUrl, {
						algorithm: 'oidc',
						[oauth.allowInsecureRequests]: allowInsecure,
					})
					.then((response) => oauth.processDiscoveryResponse(issuerUrl, response))
				// don't memoize a transient failure for the process lifetime — drop a rejected
				// discovery so the next login retries instead of failing until restart
				cache.catch(() => {
					cache = null
				})
			}
			return cache
		},
		user: ({ claims }) => {
			if (!claims) {
				throw new Error('oidc provider: the token response carried no id_token')
			}
			// only surface email when the provider asserts it's verified. A missing email_verified
			// claim counts as NOT verified (OIDC: absence is not an assertion of verification). An
			// unverified email must never be used to key/link accounts (account-takeover risk), so
			// drop it and let identity rest on `sub`.
			const verified = claims.email_verified === true
			const email = verified ? (claims.email as string | undefined) : undefined
			return {
				sub: claims.sub,
				email,
				emailVerified: email ? true : undefined,
				name: claims.name as string | undefined,
			}
		},
	}
}
