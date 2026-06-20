// Compile-time type assertions for <Link> and createMock prop typing.
// Verified by `tsc --noEmit` — not a Playwright test.

import { Link, createMock } from '$houdini'

export {}

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

// valid: /search_params declares offset/limit as optional Int search params
const _sp1 = <Link to="/search_params" search={{ offset: 2 }}>Page</Link>
const _sp2 = <Link to="/search_params" search={{ offset: 1, limit: 3 }}>Page</Link>
// search is always optional, so omitting it is fine
const _sp3 = <Link to="/search_params">Page</Link>

// wrong value type for a search param (offset is a number)
const _spe1 =
    // @ts-expect-error -- string is not assignable to the Int search param
    <Link to="/search_params" search={{ offset: 'two' }}>Bad</Link>

// unknown search key for a known route
const _spe2 =
    // @ts-expect-error -- genre is not a search param of /search_params
    <Link to="/search_params" search={{ genre: 'comedy' }}>Bad</Link>

// search on a route that declares none
const _spe3 =
    // @ts-expect-error -- /hello-world has no search params
    <Link to="/hello-world" search={{ offset: 1 }}>Bad</Link>

// ── createMock search typing ──────────────────────────────────────────────────

// valid: typed search object on a route that declares search params
const _cm1 = createMock({ url: '/search_params', search: { offset: 2 }, data: {} as any })

// wrong value type
const _cme1 = createMock({
    url: '/search_params',
    // @ts-expect-error -- offset must be a number
    search: { offset: 'two' },
    data: {} as any,
})

// unknown search key
const _cme2 = createMock({
    url: '/search_params',
    // @ts-expect-error -- genre is not a search param of /search_params
    search: { genre: 'comedy' },
    data: {} as any,
})

// search on a route that declares none
const _cme3 = createMock({
    url: '/hello-world',
    // @ts-expect-error -- /hello-world has no search params
    search: { offset: 1 },
    data: {} as any,
})

