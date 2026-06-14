// Shared type machinery for jsx-runtime.ts and jsx-dev-runtime.ts.
// Both files re-export JSX from here so the type definitions live in one place.
import type { AnchorHTMLAttributes, DetailedHTMLProps } from 'react'
import type { JSX as ReactJSX } from 'react/jsx-runtime'

// These imports only resolve after codegen writes the manifest into .houdini/.
// In the source package (template context) the path is absent — hence the suppression.
// @ts-ignore
import type rawManifest from './plugins/houdini-react/runtime/manifest.js'
// @ts-ignore
import type { RouteScalars } from './plugins/houdini-react/runtime/manifest.js'

type _Pages = (typeof rawManifest)['pages']
type _TSType<T extends string> = T extends keyof RouteScalars
	? RouteScalars[T]
	: T extends 'Int' | 'Float'
		? number
		: T extends 'ID'
			? string | number
			: T extends 'Boolean'
				? boolean
				: string
type _Param = { readonly name: string; readonly type: string; readonly optional: boolean }
type _ParamObj<Ps extends readonly _Param[]> = {
	[P in Ps[number] as P['optional'] extends true ? P['name'] : never]?: _TSType<P['type']>
} & {
	[P in Ps[number] as P['optional'] extends true ? never : P['name']]: _TSType<P['type']>
}
type _ToAnchorProps<P> = P extends {
	readonly url: infer U extends string
	readonly params: readonly []
}
	? { href: U; params?: never }
	: P extends {
				readonly url: infer U extends string
				readonly params: infer Ps extends readonly _Param[]
			}
		? { href: U; params: _ParamObj<Ps> }
		: never

// Non-route hrefs that are valid without a params object.
type _ExternalHref =
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

type RouteAnchorProps =
	// Explicit opt-out: suppressHrefTypeCheck={true} accepts any href/params.
	| {
			suppressHrefTypeCheck: true
			href?: string
			params?: Record<string, string | number | boolean>
	  }
	// External / non-routed hrefs (mailto, https, fragments, relative, …)
	| { href?: _ExternalHref; params?: never }
	// Known app routes — href and params are narrowed from the manifest.
	| _ToAnchorProps<_Pages[keyof _Pages]>

type AnchorProps = Omit<
	DetailedHTMLProps<AnchorHTMLAttributes<HTMLAnchorElement>, HTMLAnchorElement>,
	'href'
> &
	RouteAnchorProps

export declare namespace JSX {
	type Element = ReactJSX.Element
	type ElementType = ReactJSX.ElementType
	type ElementClass = ReactJSX.ElementClass
	type ElementAttributesProperty = ReactJSX.ElementAttributesProperty
	type ElementChildrenAttribute = ReactJSX.ElementChildrenAttribute
	type LibraryManagedAttributes<C, P> = ReactJSX.LibraryManagedAttributes<C, P>
	type IntrinsicAttributes = ReactJSX.IntrinsicAttributes
	type IntrinsicClassAttributes<T> = ReactJSX.IntrinsicClassAttributes<T>
	type IntrinsicElements = Omit<ReactJSX.IntrinsicElements, 'a'> & {
		a: AnchorProps
	}
}
