---
'houdini-core': minor
'houdini': minor
'houdini-react': minor
---

Add support for progressively enhanced mutations using `@endpoint` and `useMutationForm`, plus mutation-based authentication via the `@auth` directive (compose with `@endpoint` for no-JS login). The redirect-based auth config field `auth.redirect` is replaced by a single `auth.url` that defaults to a built-in endpoint.
