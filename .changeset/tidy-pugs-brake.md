---
'houdini-react': minor
---

useQuery now resolves during server-side rendering and hydrates from the streamed cache snapshot without a client refetch, with suspense state scoped per request so one request can never serve another's data. Also fixes several reactivity gaps: components now react to cache updates after the initial load, queries shared by multiple components or double-mounted under StrictMode stay reactive, abandoned fetches no longer leak their cache subscriptions, and a parent re-render while the query is still in flight no longer commits the component with empty data.
