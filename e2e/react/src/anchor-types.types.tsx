// Compile-time type assertions for anchor prop typing.
// Verified by `tsc --noEmit` — not a Playwright test.

export {}

// ── valid usages ─────────────────────────────────────────────────────────────

// known static route
const _s1 = <a href="/">Home</a>
const _s2 = <a href="/hello-world">Hello</a>
// external links via _ExternalHref escape hatch
const _s3 = <a href="https://example.com">HTTPS</a>
const _s4 = <a href="mailto:hi@example.com">Email</a>
const _s5 = <a href="#section">Fragment</a>
const _s6 = <a href="./relative">Relative</a>
// parameterized route — GQL ID accepts string or number
const _s7 = <a href="/route_params/[id]" params={{ id: '1' }}>User</a>
const _s7b = <a href="/route_params/[id]" params={{ id: 1 }}>User</a>
// data-houdini-preload on a known route
const _s8 = <a href="/hello-world" data-houdini-preload>Preload</a>
// key prop works (from ClassAttributes via DetailedHTMLProps)
const _s9 = <a href="/hello-world" key="nav">Nav</a>
// other standard attributes still work
const _s10 = <a href="https://example.com" target="_blank" rel="noopener noreferrer">New tab</a>
// suppressHrefTypeCheck opts out of validation entirely
const _s11 = <a suppressHrefTypeCheck href="/anything-at-all">Dynamic</a>
const _s12 = <a suppressHrefTypeCheck href="/api/endpoint" params={{ foo: 'bar' }}>API</a>

// ── invalid usages ────────────────────────────────────────────────────────────

// href must be a string
const _e1 =
    // @ts-expect-error
    <a href={42}>Bad</a>

// params must be a plain object, not a primitive
const _e2 =
    // @ts-expect-error
    <a href="/route_params/[id]" params={false}>Bad</a>

// params must be a plain object, not a string
const _e3 =
    // @ts-expect-error
    <a href="/route_params/[id]" params="id=1">Bad</a>

// unknown internal routes are rejected (not in the manifest, not external)
const _e4 =
    // @ts-expect-error
    <a href="/not-a-real-route">Bad</a>

// wrong param key for a known route
const _e5 =
    // @ts-expect-error
    <a href="/route_params/[id]" params={{ userId: '1' }}>Bad</a>

// missing params entirely for a parameterized route
const _e7 =
    // @ts-expect-error
    <a href="/route_params/[id]">Bad</a>
