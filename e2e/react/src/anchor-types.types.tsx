// Compile-time type assertions for <Link>, createMock, and goto prop typing.
// Verified by `tsc --noEmit` — not a Playwright test.

import { Link, createMock, useRoute, type GenericRoute } from '$houdini'

export {}

// useRoute() with no Route type still gives pathname + goto for navigation-only code
const { goto } = useRoute()

// ...but params/search are empty without a PageRoute generic, so reading a key is an error
const _bare = useRoute()
// @ts-expect-error -- search is {} until you pass useRoute<PageRoute>()
_bare.search.offset
// @ts-expect-error -- params is {} until you pass useRoute<PageRoute>()
_bare.params.id

// a route-agnostic component (e.g. a reusable paginator) can type just the search keys it
// depends on via GenericRoute — search comes first, params defaults to never (no assumption)
const _paginator = useRoute<GenericRoute<{ after?: string | null; first?: number | null }>>()
const _after: string | null | undefined = _paginator.search.after
// @ts-expect-error -- limit was not declared on the GenericRoute search shape
_paginator.search.limit
// params was opted out (defaulted to never), so it's a loose record — reading a key is allowed
const _anyParam: unknown = _paginator.params.anything

// ── valid usages ─────────────────────────────────────────────────────────────

// known static routes
const _s1 = <Link to="/">Home</Link>
const _s2 = <Link to="/hello-world">Hello</Link>
// external links
const _s3 = <Link to="https://example.com">HTTPS</Link>
const _s4 = <Link to="mailto:hi@example.com">Email</Link>
const _s5 = <Link to="#section">Fragment</Link>
const _s6 = <Link to="./relative">Relative</Link>
// parameterized route — GQL ID accepts string or number
const _s7 = <Link to="/route_params/[id]" params={{ id: '1' }}>User</Link>
const _s7b = <Link to="/route_params/[id]" params={{ id: 1 }}>User</Link>
// parameterized route with number id
const _s8 = <Link to="/route_params/[id]" params={{ id: 42 }}>User</Link>
// preload prop on a known route
const _s9 = <Link to="/hello-world" preload>Preload</Link>
const _s9b = <Link to="/hello-world" preload="data">Preload</Link>
// key prop works (from ClassAttributes via DetailedHTMLProps)
const _s10 = <Link to="/hello-world" key="nav">Nav</Link>
// other standard attributes still work
const _s11 = <Link to="https://example.com" target="_blank" rel="noopener noreferrer">New tab</Link>

// ── invalid usages ────────────────────────────────────────────────────────────

// to must be a string
const _e1 =
    // @ts-expect-error -- number is not a valid route
    <Link to={42}>Bad</Link>

// unknown route is rejected
const _e4 =
    // @ts-expect-error -- /not-a-real-route is not in the manifest
    <Link to="/not-a-real-route">Bad</Link>

// params must be a plain object, not a primitive
const _e2 =
    // @ts-expect-error -- boolean is not a valid params value
    <Link to="/route_params/[id]" params={false}>Bad</Link>

// params must be a plain object, not a string
const _e3 =
    // @ts-expect-error -- string is not a valid params object
    <Link to="/route_params/[id]" params="id=1">Bad</Link>

// wrong param key for a known route
const _e5 =
    // @ts-expect-error -- userId is not a valid param for /route_params/[id]
    <Link to="/route_params/[id]" params={{ userId: '1' }}>Bad</Link>

// missing params entirely for a parameterized route
const _e7 =
    // @ts-expect-error -- params required for parameterized route
    <Link to="/route_params/[id]">Bad</Link>

// ── search params ─────────────────────────────────────────────────────────────

// the route's nullable query variables are typed: /search_params declares offset/limit
const _sp1 = <Link to="/search_params" search={{ offset: 2 }}>Page</Link>
const _sp2 = <Link to="/search_params" search={{ offset: 1, limit: 3 }}>Page</Link>
// search is always optional, so omitting it is fine
const _sp3 = <Link to="/search_params">Page</Link>
// extra keys are allowed alongside the typed ones (UI-only query string state)
const _sp4 = <Link to="/search_params" search={{ offset: 2, tab: 'reviews' }}>Page</Link>
// search works on a route that declares no query search params at all
const _sp5 = <Link to="/hello-world" search={{ tab: 'reviews' }}>Page</Link>

// wrong value type for a declared search param is still caught
const _spe1 =
    // @ts-expect-error -- string is not assignable to the Int search param
    <Link to="/search_params" search={{ offset: 'two' }}>Bad</Link>

// ── createMock search typing ──────────────────────────────────────────────────

// typed search object on a route that declares search params
const _cm1 = createMock({ url: '/search_params', search: { offset: 2 }, data: {} as any })
// extra UI-only keys are allowed alongside the typed ones
const _cm2 = createMock({ url: '/search_params', search: { offset: 2, tab: 'x' }, data: {} as any })
// search on a route that declares no query search params
const _cm3 = createMock({ url: '/hello-world', search: { tab: 'x' }, data: {} as any })

// wrong value type for a declared search param is still caught
const _cme1 = createMock({
    url: '/search_params',
    // @ts-expect-error -- offset must be a number
    search: { offset: 'two' },
    data: {} as any,
})

// createMock params accept only the params the route declares
const _cmp1 = createMock({ url: '/route_params/[id]', params: { id: '1' }, data: {} as any })
const _cmpe1 = createMock({
    url: '/route_params/[id]',
    // @ts-expect-error -- userId is not a param of /route_params/[id]
    params: { userId: '1' },
    data: {} as any,
})
// @ts-expect-error -- params is required for a parameterized route
const _cmpe2 = createMock({ url: '/route_params/[id]', data: {} as any })

// ── goto: same typed targets as <Link> ────────────────────────────────────────

// a bare string is always allowed (escape hatch)
goto('/anything?with=querystring')
// typed targets: params required for parameterized routes, search typed + optional
goto({ to: '/route_params/[id]', params: { id: '1' } })
goto({ to: '/search_params', search: { offset: 2 } })
goto({ to: '/search_params', search: { offset: 2, tab: 'reviews' } })

// @ts-expect-error -- params required for a parameterized route
goto({ to: '/route_params/[id]' })
// @ts-expect-error -- genre... offset is an Int, a string is not assignable
goto({ to: '/search_params', search: { offset: 'two' } })
// @ts-expect-error -- not a known route
goto({ to: '/not-a-real-route' })

