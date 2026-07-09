---
'houdini-react': minor
---

useQuery now resolves during server-side rendering and hydrates from the streamed cache snapshot without a client refetch, with suspense state scoped per request so one request can never serve another's data. Session changes invalidate useQuery results (and mark the cache stale) so session-dependent queries refetch, GraphQL errors reach the nearest error boundary instead of crashing the component, and several reactivity gaps are fixed: cache updates after the initial load, queries shared by multiple components or double-mounted under StrictMode, leaked subscriptions from abandoned fetches, and mid-flight parent re-renders committing empty data.
