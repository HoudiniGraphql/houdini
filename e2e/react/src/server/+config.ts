// Server-only Houdini config. src/server is compiled into the server bundle only, so secrets live
// here — never in houdini.config, which the client bundles for scalars. Typed as
// ServerConfigFile so it stays distinct from the public config. (TypeScript config supported.)
import type { ServerConfigFile } from 'houdini'
import { oidc } from 'houdini/oauth'

// the e2e drives against a real third-party OIDC provider mock (oauth2-mock-server, started by
// Playwright as oauth-mock.mjs) using the stock `oidc` adapter — so the flow is exercised against
// an independent implementation of the spec, including id_token signature + nonce validation.
export default {
	auth: {
		// in a real app: [process.env.SESSION_SECRET, ...older keys for rotation]
		sessionKeys: ['supersecret'],
		providers: {
			stub: oidc({
				issuer: 'http://localhost:8081',
				clientId: 'stub-client',
				clientSecret: 'stub-secret',
				allowInsecureRequests: true, // local http mock only
			}),
		},
		onSignIn: ({ user }) => ({ userId: user.sub, email: user.email }),
	},
} satisfies ServerConfigFile
