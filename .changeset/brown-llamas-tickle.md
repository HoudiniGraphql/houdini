---
'houdini': patch
---

createLRUCache accepts an onEvict callback that fires whenever an entry leaves the cache (capacity eviction, delete, overwrite, or clear).
