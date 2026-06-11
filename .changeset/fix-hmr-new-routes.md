---
'houdini': patch
'houdini-react': patch
---

fix HMR not regenerating the router manifest when a new `+page` or `+layout` file is added; invalidate component fields cache after each HMR cycle
