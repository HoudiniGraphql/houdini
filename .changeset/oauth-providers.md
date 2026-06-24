---
'houdini': minor
'houdini-react': minor
---

Add first-class OAuth login. Configure providers from `houdini/oauth` (the generic `oidc` adapter, or `github`) in `src/server/+config`; Houdini runs the Authorization Code + PKCE flow itself, validates the `id_token`, and hands the profile to an `onSignIn` hook that returns the session. A typed `loginURL({ provider })` is generated from your configured providers.
