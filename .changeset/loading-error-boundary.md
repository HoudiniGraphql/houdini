---
'houdini-react': patch
---

Fix a query with `@loading` that errors during SSR hanging on its loading state instead of reaching the nearest `+error.tsx` boundary.
