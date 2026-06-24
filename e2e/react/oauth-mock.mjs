// A real third-party OIDC provider mock (oauth2-mock-server) for the first-class OAuth e2e. It
// implements discovery, /authorize, /token (a properly RS256-signed id_token + nonce propagation),
// and /jwks — so the browser round-trip is verified against an INDEPENDENT implementation of the
// spec, not a stub we wrote. Started as a Playwright webServer alongside the app.
import { OAuth2Server } from 'oauth2-mock-server'

const PORT = Number(process.env.MOCK_PORT ?? 8081)

const server = new OAuth2Server()
await server.issuer.keys.generate('RS256')

// stamp the id_token with the user the e2e asserts on. The mock carries the `nonce` from /authorize
// into the token itself, so we only set identity claims here.
server.service.on('beforeTokenSigning', (token) => {
	token.payload.sub = 'stub-user-1'
	token.payload.email = 'stub@example.com'
	// a real provider asserts verification for a login email; the oidc adapter drops an
	// unverified/unmarked email, so the mock must mark it verified for it to flow to the session
	token.payload.email_verified = true
})

await server.start(PORT, 'localhost')
console.log(`oauth2 mock provider on ${server.issuer.url}`)
