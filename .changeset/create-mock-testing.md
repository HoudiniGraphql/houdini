---
'houdini-react': minor
'houdini-core': minor
---

add `createMock` for first-class testing support — returns a fully composed React component for any route, wired with a fresh cache and mock network client. Every query and mutation artifact now exports a `$unmasked` type representing the fully-resolved server payload with all fragment fields inlined and no mask annotations.
