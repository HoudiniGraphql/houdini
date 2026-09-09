---
'houdini': patch
'houdini-core': patch
---

Make generated artifact field order deterministic so incremental rebuilds no longer rewrite (and hot-reload) artifacts whose content didn't actually change.
