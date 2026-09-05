---
"houdini": patch
"houdini-core": patch
"houdini-svelte": patch
"houdini-react": patch
---

Generated runtime files now start with `// @ts-nocheck` so strict app-level tsconfig options like `noUncheckedIndexedAccess` no longer fail the build on code you don't own.
