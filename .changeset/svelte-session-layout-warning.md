---
'houdini-svelte': patch
---

Warn at build time when your hooks file calls `setSession` but the root layout files (`src/routes/+layout.server.js` or `src/routes/+layout.svelte`) are missing, since the session is silently dropped without them.
