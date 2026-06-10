---
'houdini-react': patch
---

Fix FOUC in dev mode by collecting CSS from the Vite module graph and passing them as React 19 stylesheet links that get hoisted to <head> during SSR
