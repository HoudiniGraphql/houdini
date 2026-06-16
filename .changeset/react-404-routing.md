---
"houdini-react": minor
"houdini": minor
---

Add `notFound()` function and static 404 routing: unmatched URLs find the deepest prefix-matching page, render its layout chain with the correct error boundary, and return HTTP 404 before streaming begins.
