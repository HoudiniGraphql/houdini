---
'houdini': patch
'houdini-core': patch
---

Fix compiler database integrity and diagnostics: foreign keys are now enforced (deferred to commit) across all writers, stale documents from deleted or changed files are cleaned up during extraction, multi-file change batches extract every file, generated documents no longer produce phantom validation errors in long-lived sessions (dev server, language server), and validation errors anchor at the offending selection instead of the top of the file.
