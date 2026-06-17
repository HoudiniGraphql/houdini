---
'houdini': patch
'houdini-react': patch
'houdini-svelte': patch
---

Fixed a flash of intermediate data during single-page fragment pagination and unnecessary network requests on backward navigation by suppressing partial cache hits and preserving marshaled variables across consecutive sends.
