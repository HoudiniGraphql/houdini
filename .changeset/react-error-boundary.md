---
"houdini-react": minor
---

Add `+error.tsx` support — a page-level error boundary that wraps `+page.tsx`, receives layout query data and an `errors: Array<Error | GraphQLError>` prop, and exposes an `ErrorProps` type via `$types`.
