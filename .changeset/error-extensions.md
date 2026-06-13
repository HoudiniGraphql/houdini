---
'houdini': patch
'houdini-react': patch
---

GraphQL errors now expose `locations`, `path`, and `extensions` per the spec; augment `App.GraphQLErrorExtensions` to type your server's extensions.
