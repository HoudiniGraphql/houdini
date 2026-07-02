---
'houdini': minor
'houdini-react': minor
---

Client-side navigations no longer flash a route's `@loading` state. Fast navigations hold the previous page until the next one is ready; a navigation pending longer than `router.loadingDelay` (default 200ms) renders the destination's `@loading` frame, which then stays up for at least `router.minDuration` (default 400ms) once shown. Routes without an `@loading` query simply hold the previous page for the whole navigation. Note that route boundaries now persist across same-route navigations, so page-level React state survives param-only navigations (previously every navigation remounted the page).
