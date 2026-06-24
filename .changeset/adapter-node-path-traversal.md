---
'houdini-adapter-node': patch
---

Fix a path traversal in the node adapter's static file server. A request such as `/assets/../ssr/entries/adapter.js` or `/assets/../../etc/passwd` could escape the assets directory and read the server bundle (which holds session signing keys) or other files. Static requests are now confined to the built assets directory.
