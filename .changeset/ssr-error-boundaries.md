---
'houdini-react': patch
---

A direct load whose render throws now renders `+error.tsx` with the correct HTTP status instead of a raw stack trace, and a thrown `redirect()` responds with a real `Location` header.
