---
'houdini-core': patch
---

Rework argument type validation to follow the GraphQL spec ([#1645](https://github.com/HoudiniGraphql/houdini/issues/1645)): static list values and spec coercions (`Int`→`Float`/`ID`, block strings, single values at list locations) are now accepted, `@with` values are fully checked against the fragment's declared argument types, and unknown enum values, strings for enums, and unknown variable types are now reported.
