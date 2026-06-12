---
'houdini-react': patch
'houdini': patch
---

prevent unnecessary re-renders on fragments by stabilizing returned values and skipping subscription updates when data hasn't changed
