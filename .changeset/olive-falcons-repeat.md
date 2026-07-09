---
'houdini': patch
---

Fix runtime scalars being silently dropped when the config is re-seeded on a persisted database (e.g. a long-running dev server after adding a new runtime scalar).
