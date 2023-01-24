---
'houdini-svelte': major
---

Removed `@manual_load` since queries defined inline in a component are no longer automatically loaded. In order to opt into generated loads for your inline queries, use the `@load` directive
