---
'houdini-core': patch
---

Fix several bugs in paginated connection artifact generation: `@paginate` on a nested field no longer produces an empty refetch path; `hasNextPage`/`hasPreviousPage` updates now propagate correctly; `endCursor`/`startCursor` no longer receive wrong-direction updates; and cache updates no longer leak to grandchildren of paginated connections
