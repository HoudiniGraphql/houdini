---
"houdini": patch
"houdini-react": minor
---

Navigations now hold the previous page and only show the destination's `@loading` state when the navigation is slow, configurable via `router.loadingDelay` and `router.minDuration`. As part of this, a navigation that stays on the same route no longer remounts the page component, so component state persists when only params or search values change.
