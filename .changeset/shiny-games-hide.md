---
'houdini-core': patch
'houdini': patch
---

Fix generated types dropping selections made directly on an interface field when the selection also contains inline fragments; fields like `nodes { id }` and fragment spreads on the interface now appear on the object intersected with the discriminated union.
