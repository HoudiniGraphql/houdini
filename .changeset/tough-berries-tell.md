---
'houdini-core': patch
'houdini': patch
---

Fix generated types keeping fields optional when a fragment is spread with `@include`/`@skip` in one place and unconditionally in another; the unconditional spread now makes the fields required.
