---
'houdini': patch
---

Set a SQLite busy timeout so concurrent codegen writers wait for the lock instead of failing with "database is locked"
