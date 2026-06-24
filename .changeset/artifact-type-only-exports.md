---
'houdini-core': patch
'houdini': patch
---

Re-export generated artifacts from the runtime index (`$houdini`) as types only. The artifact's runtime value is its default export, so the previous value-level `export *` statically pulled every artifact into the entry chunk and defeated the router manifest's per-route dynamic import. A type-only re-export keeps the same types available while letting each artifact code-split into its route's chunk (fixes the `INEFFECTIVE_DYNAMIC_IMPORT` build warnings).
