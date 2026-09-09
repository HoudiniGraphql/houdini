---
'houdini': patch
'houdini-core': patch
---

Fix dev-server rebuilds dropping fragments from generated documents: saving a file that defines a fragment no longer strips nested fragment definitions and their fields from queries that reference them.
