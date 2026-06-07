---
'houdini': patch
'houdini-svelte': patch
'houdini-core': patch
---

Fix TypeScript types for fragment masking on abstract/interface fields.

`fragment()` and `paginatedFragment()` now correctly accept query results that
come from abstract type fields (interfaces and unions). The generated type for
a concrete variant now includes the `" $fragments"` marker required to pass the
value to a fragment store, and the non-exhaustive variant is typed compatibly
with `Fragment<T>` so the whole union can be passed without a cast.

`houdini-svelte`: the `fragment()` overloads now infer `_Data` from the store
rather than from `_Fragment['shape']`, fixing a case where the return type
collapsed to `never` for query-result refs that lack a `shape` property.
`paginatedFragment()` now accepts paginated stores that extend
`BasePaginatedFragmentStore` directly, removing a false class-hierarchy error.
