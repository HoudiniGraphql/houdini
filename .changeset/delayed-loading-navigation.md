---
'houdini': minor
'houdini-react': minor
---

Client-side navigations now hold the previous page instead of flashing the route's `@loading` state, showing the destination's loading state only when a navigation stays pending longer than `router.loadingDelay` (default 200ms) and keeping it visible at least `router.minDuration` (default 400ms). Route boundaries also persist across same-route navigations, so page-level React state survives param-only navigations.
