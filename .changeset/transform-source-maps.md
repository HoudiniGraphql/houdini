---
'houdini': patch
'houdini-react': patch
'houdini-svelte': patch
---

Fix source maps for route and component files: rewriting `graphql()` tags no longer shifts stack traces and breakpoints off the original source lines.
