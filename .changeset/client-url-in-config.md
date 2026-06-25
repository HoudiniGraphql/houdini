---
'houdini': minor
---

The GraphQL endpoint URL now lives in `houdini.config.js` rather than being passed to `new HoudiniClient({ url })`; passing a `url` to `HoudiniClient` now throws. The configured URL is injected into the runtime during codegen.
