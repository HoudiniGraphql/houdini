---
'houdini': patch
'houdini-core': patch
---

Fix compiler database integrity: foreign keys are now enforced (deferred to commit) across all writers, stale documents from deleted or changed files are cleaned up during extraction, multi-file change batches extract every file, and `@list` reports its correct FIELD location.
