---
'houdini': patch
'houdini-core': patch
---

Fix the persisted queries file never being written: setting `persistedQueriesPath` in `houdini.config.js` or passing `-o`/`--output` to `houdini generate` now produces the hash-to-query map file as documented.
