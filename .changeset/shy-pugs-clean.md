---
'houdini': patch
---

Stop the codegen plugin processes when Vite closes the dev server. They used to outlive a Vitest run or any other server embedding Vite in middleware mode.
