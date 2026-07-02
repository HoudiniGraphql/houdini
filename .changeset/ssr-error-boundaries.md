---
'houdini-react': patch
---

A direct (SSR) load whose render throws — a query resolving with GraphQL errors, `notFound()`, `httpError()` — now renders `+error.tsx` with the correct HTTP status instead of responding with a raw stack trace, and a thrown `redirect()` answers with a real `Location` header.
