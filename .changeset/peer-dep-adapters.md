---
'houdini-adapter-auto': patch
'houdini-adapter-cloudflare': patch
'houdini-adapter-node': patch
'houdini-adapter-static': patch
---

Move houdini from dependencies to peerDependencies to prevent duplicate installs when adapter and houdini versions differ
