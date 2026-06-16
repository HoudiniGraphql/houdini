---
'houdini': patch
'houdini-react': patch
---

fix fragment pagination: `cursorHandlers` now derives entity variables via the type config and applies artifact defaults automatically, so `useFragmentHandle` works the same as query pagination without any special wiring.
