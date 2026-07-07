---
'houdini': patch
---

Fix `App.Session` augmentations not applying to session-typed fields in `ConfigFile` (a local type alias was shadowing the global interface).
