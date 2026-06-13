---
'houdini-core': patch
---

Fix argument type validation rejecting static list values ([#1645](https://github.com/HoudiniGraphql/houdini/issues/1645)) and align it with the GraphQL spec. Now accepted: list literals (`ids: [1, 2, 3]`), `Int` literals for `Float` and `ID` arguments, block strings for `String` arguments, single values at list locations (coerced per the spec), and `@with`/`@arguments` values that previously hit false positives (single values and empty lists for list-typed fragment arguments, defaults using `ID`, `Float`, enum, or custom scalar types). Now rejected (previously accepted in error): strings passed to enum arguments, unknown enum values, `null` inside lists of non-null elements, `null` passed via `@with` to non-null fragment arguments, scalar values passed via `@with` to fragment arguments of a different scalar type, and variables whose default value was used to skip type checking entirely — defaults now only forgive outer nullability per the spec.
