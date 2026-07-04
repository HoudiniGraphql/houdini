---
'houdini': patch
---

Fix local schema watching to look for `src/server/+schema`; the watcher was still checking the old `src/api` location, so local schemas were never serialized at startup and schema edits didn't trigger codegen.
