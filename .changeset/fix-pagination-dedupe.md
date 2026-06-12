---
'houdini-react': patch
'houdini': patch
---

fix gaps in pagination request deduplication: stale inflight entries no longer block new requests, and ssr_signals now covers client-side concurrent renders to prevent duplicate observer/send pairs
