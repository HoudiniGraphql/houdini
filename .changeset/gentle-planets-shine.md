---
'houdini-core': patch
'houdini': patch
---

Fix generated `$result` types including pipeline-added key fields (e.g. `id`) in interface/union arms the document never selected; fields selected on the abstract type itself still appear in every arm.
