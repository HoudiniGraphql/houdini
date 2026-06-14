// Compile-time type assertions for <Link> prop typing.
// Verified by `tsc --noEmit` — not a Playwright test.

import { Link } from '$houdini'

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
// data-houdini-preload on a known route
const _s9 = <Link to="/hello-world" data-houdini-preload>Preload</Link>
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

