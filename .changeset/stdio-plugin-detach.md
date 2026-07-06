---
'houdini': patch
---

Don't detach stdio-transport plugin processes; detached children can't read their stdin pipe in WebContainers, which broke codegen there.
