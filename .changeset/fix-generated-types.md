---
"houdini": patch
"houdini-core": patch
---

Fix three issues in generated TypeScript types: loading states now use field aliases instead of schema names, runtime scalar variables are optional in the input type since their values are resolved automatically, and `$optimistic` types wrap list fields in arrays.
