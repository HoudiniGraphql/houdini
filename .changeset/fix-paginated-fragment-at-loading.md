---
'houdini': patch
'houdini-svelte': patch
'houdini-react': patch
---

A paginated fragment spread on an `@loading` query no longer fires a `node(id: PendingValue)` request while its parent is still loading. The pagination handlers no-op until the parent entity resolves, so the fragment works without an `if (!loading)` guard.
