---
'houdini-core': patch
'houdini': patch
---

Fix generated types dropping fields when multiple `@mask_disable` fragments select the same field with different sub-selections; the sub-selections are now merged instead of keeping only the first occurrence.
