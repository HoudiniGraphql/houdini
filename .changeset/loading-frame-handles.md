---
'houdini-react': patch
---

Loading frames now receive real `$handle` props, so a component that reads its handle during a loading state no longer crashes.
