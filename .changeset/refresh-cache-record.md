---
'houdini': minor
'houdini-core': minor
---

Add `refresh()` to cache records: every document whose data contains the record refetches itself from the API, including documents that only contain the record behind a fragment spread. The cache now pushes tagged messages to subscribers (`{ kind: 'update', data }` / `{ kind: 'refetch' }`) and the `set` callback on subscription specs is now called `onMessage`, which is a breaking change for anyone calling `cache.subscribe` directly.
