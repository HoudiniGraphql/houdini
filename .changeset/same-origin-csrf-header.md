---
'houdini-core': patch
'houdini': patch
---

Only send the `x-houdini-request` header on same-origin requests, so client-side requests to a remote API no longer fail CORS preflight.
