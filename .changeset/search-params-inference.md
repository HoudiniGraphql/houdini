---
'houdini': minor
'houdini-react': minor
---

Infer search params for React routes: a page query's nullable variables are now populated from `URLSearchParams` and drive the query (changing the query string re-runs it), exposed as an optional, type-safe `search` prop on `Link`. Required variables that aren't satisfied by a route segment are caught at build time.
