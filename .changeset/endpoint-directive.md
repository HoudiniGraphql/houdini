---
'houdini-core': minor
'houdini': minor
'houdini-react': minor
---

Add support for progressively enhanced mutations using `@endpoint` and `useMutationForm`, plus writing the session from a mutation result with the `@session(path:, merge:)` directive (login, preferences, and logout — compose with `@endpoint` for no-JS). The redirect-based auth config field `auth.redirect` is replaced by a single `auth.url` that defaults to a built-in endpoint.
