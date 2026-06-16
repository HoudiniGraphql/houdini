---
'houdini-react': patch
'houdini': patch
---

Fix `useMutation` to return `[mutate, pending]` instead of `[pending, mutate]`, and fix list toggle operations accumulating across resolved optimistic mutation layers causing subsequent toggles to appear stuck.
