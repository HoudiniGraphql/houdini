---
'houdini': minor
'houdini-react': minor
---

Pages and layouts can now export a `headers()` function to set HTTP response headers for a route. Headers from the page and its layout chain are merged before streaming, with the page taking precedence over its layouts.
