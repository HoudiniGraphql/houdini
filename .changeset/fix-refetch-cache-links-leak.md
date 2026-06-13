---
'houdini': patch
---

Fix cache link leak when refetching connections — embedded edge records now reuse their existing keys on write instead of generating new ones, and records that fall out of the list are cleaned up immediately.
