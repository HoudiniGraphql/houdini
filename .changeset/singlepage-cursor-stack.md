---
'houdini': minor
'houdini-react': minor
---

Fix SinglePage cursor pagination to use replace semantics instead of accumulating edges, and add cursor-stack support so forward-only APIs can navigate backward and backward-only APIs can navigate forward after they've seen the previous page.
