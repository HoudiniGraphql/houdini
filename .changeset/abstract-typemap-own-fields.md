---
'houdini-core': patch
'houdini': patch
---

Fix union/interface members with their own inline fragment being read through a shared abstract fragment's narrower selection, which silently dropped their type-specific fields at cache-read time.
