---
'houdini-react': minor
---

Add typed anchor hrefs: `<a href="/route/[id]" params={{ id }}>`  is type-checked against the manifest, with custom scalar support via `RouteScalars` and correct interpolation of optional `[[param]]` and rest `[...slug]` segments.
