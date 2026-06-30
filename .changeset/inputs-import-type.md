---
'houdini-core': patch
'houdini': patch
---

Generate the enum imports in `inputs.ts` with `import type` so projects using TypeScript's `verbatimModuleSyntax` no longer fail to compile.
