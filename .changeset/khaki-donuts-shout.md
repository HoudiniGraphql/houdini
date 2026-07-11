---
'houdini-core': patch
'houdini': patch
---

Fix custom scalars mapped to non-default TypeScript types (e.g. `URL`, `bigint`) failing the `GraphQLObject` constraint on stores; the generated runtime now registers the project's scalar types with `houdini/runtime`.
