---
'houdini': patch
'houdini-core': patch
---

Fix plugin processes leaking when the orchestrator dies or fails setup before connecting: plugins now exit if no connection arrives within two minutes, and a failed startup kills the plugins it already spawned.
