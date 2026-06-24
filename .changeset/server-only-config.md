---
'houdini': minor
'houdini-core': minor
'houdini-react': minor
'create-houdini': minor
---

Add server-backed sessions to the React runtime. A server-only `src/server/+config` (typed `ServerConfigFile`) holds the session signing keys, the session and GraphQL endpoints, and the form CSRF settings, keeping secrets out of the client bundle while the public endpoints are injected at render. First-class OAuth comes built in: configure `providers` from `houdini/oauth` (the generic `oidc` adapter or `github`), and Houdini runs the Authorization Code + PKCE flow, validates the result, and hands the user to an `onSignIn` hook, with a typed `loginURL({ provider })` generated for you. A hardened redirect-login escape hatch (browser-bound transaction nonce) is also available for delegating provider OAuth to a trusted integration.
