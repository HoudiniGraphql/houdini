---
'houdini': minor
'houdini-core': minor
'houdini-react': minor
'create-houdini': minor
---

Introduce a server-only `src/server/+config` file (typed `ServerConfigFile`) that holds the session signing keys, the session and GraphQL endpoints, and the form CSRF settings, keeping secrets out of the client bundle while the public endpoints are injected at render. Also adds a hardened redirect-login escape hatch (`loginURL` with a browser-bound transaction nonce) for delegating provider OAuth to a trusted integration, and renames the local API directory from `src/api` to `src/server`.
