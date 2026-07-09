---
'houdini': patch
---

Hydrated cache data now registers with the stale manager, so markStale (and anything built on it, like session invalidation) reaches data that arrived via SSR hydration instead of silently skipping it.
