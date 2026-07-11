---
'houdini-core': patch
'houdini': patch
'houdini-svelte': patch
---

Fix `cache.read`/`cache.write` and record-level `read`/`write` resolving their types to a union of every document; documents are now matched by their artifact so `data` and `variables` are typed per document.
