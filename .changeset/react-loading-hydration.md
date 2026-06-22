---
'houdini-core': patch
'houdini': patch
'houdini-react': patch
---

Fix React `@loading` pages failing to hydrate on the client, which left them non-interactive and prevented paginated fragments spread on an `@loading` query from rendering or paginating once the data resolved.
