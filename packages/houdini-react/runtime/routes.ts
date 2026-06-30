// this file is part of houdini's generated runtime — do not edit
//
// It is the single source of per-route typing: the types here are derived from the
// generated manifest's shape and drive <Link>, goto(), and createMock so the rules for
// "which params/search does this route accept" live in exactly one place.

// @ts-ignore
import type rawManifest from './manifest.js'
// @ts-ignore
import type { _TSType } from './manifest.js'

type _Pages = (typeof rawManifest)['pages']

// ---- route params ----

type _Param = { readonly name: string; readonly type: string; readonly optional: boolean }
type _ParamObj<Ps extends readonly _Param[]> = {
	[P in Ps[number] as P['optional'] extends true ? P['name'] : never]?: _TSType<P['type']>
} & {
	[P in Ps[number] as P['optional'] extends true ? never : P['name']]: _TSType<P['type']>
}

// ---- search params ----

// Search params are derived from a query's nullable variables, so every key is
// optional. A `List`-wrapped variable accepts an array (serialized as repeated keys).
type _SearchParam = {
	readonly name: string
	readonly type: string
	readonly wrappers: readonly string[]
}
type _SearchValue<P extends _SearchParam> = 'List' extends P['wrappers'][number]
	? _TSType<P['type']>[]
	: _TSType<P['type']>
// The route's nullable query variables get precise types, but search isn't limited to
// them: extra keys are allowed so the query string can also carry UI-only state that no
// query reads (a selected tab, an open modal, a client-side sort). The query consumes
// only the declared keys; the rest just ride along in the URL.
type _SearchObj<Ps extends readonly _SearchParam[]> = {
	[P in Ps[number] as P['name']]?: _SearchValue<P>
} & Record<string, unknown>

// ---- public route typing ----

// All known app route URL strings — useful as a constraint for custom link wrappers.
export type RouteHrefs = _Pages[keyof _Pages] extends { readonly url: infer U extends string }
	? U
	: never

// hrefs that aren't app routes: external links, mailto/tel, fragments, relative paths.
export type ExternalHref =
	| `http://${string}`
	| `https://${string}`
	| `mailto:${string}`
	| `tel:${string}`
	| `blob:${string}`
	| `data:${string}`
	| `//${string}`
	| `#${string}`
	| `./${string}`
	| `../${string}`

type _PageForRoute<H extends string> = Extract<_Pages[keyof _Pages], { readonly url: H }>

// params is required (and typed) when the route has dynamic segments, and absent
// otherwise. Kept a separate intersection so TS evaluates `to` independently — route
// completions still include parameterized routes even before params is filled in.
export type ParamsForRoute<H extends string> = [_PageForRoute<H>] extends [never]
	? { params?: never }
	: _PageForRoute<H> extends { readonly params: readonly [] }
		? { params?: never }
		: _PageForRoute<H> extends { readonly params: infer Ps extends readonly _Param[] }
			? { params: _ParamObj<Ps> }
			: { params?: never }

// search is always optional and always open (any route can carry UI-only query string
// state). When the route declares nullable query variables, those keys get precise
// types; otherwise search is just an open record of serializable values.
export type SearchForRoute<H extends string> = [_PageForRoute<H>] extends [never]
	? { search?: Record<string, unknown> }
	: _PageForRoute<H> extends { readonly searchParams: infer Ps extends readonly _SearchParam[] }
		? { search?: _SearchObj<Ps> }
		: { search?: Record<string, unknown> }

// a typed navigation target: a known route plus its (typed) params and search. Used by
// goto(); <Link> intersects the same pieces onto its anchor props.
export type NavTarget<H extends RouteHrefs> = { to: H } & ParamsForRoute<H> & SearchForRoute<H>

// goto() accepts either a ready-made url string (escape hatch) or a typed NavTarget.
export interface Goto {
	(url: string): void
	<H extends RouteHrefs>(target: NavTarget<H>): void
}
