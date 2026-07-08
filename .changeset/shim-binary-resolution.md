---
'houdini-core': patch
'houdini-svelte': patch
'houdini-react': patch
'houdini': patch
---

Fix plugin binary resolution failing in linked or monorepo setups, which caused `houdini generate` to hang. The plugin launcher now resolves its native binary from the invoking project and refuses to re-execute itself when the binary can't be found, reporting a clear error instead.
