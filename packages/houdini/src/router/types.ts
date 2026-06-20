import type { createYoga } from 'graphql-yoga'

import type { QueryArtifact } from '../runtime/types.js'
import type { RouteParam } from './match.js'

export type YogaServer = ReturnType<typeof createYoga>
export type YogaServerOptions = Parameters<typeof createYoga>[0]

// to decide what bundle to load and render for a given url
export type RouterManifest<_ComponentType> = {
	pages: Record<string, RouterPageManifest<_ComponentType>>
}

export type { ServerAdapterFactory } from './server.js'

export type RouterPageManifest<_ComponentType> = {
	id: string
	// the navigable url for this page (route groups stripped), e.g. "/users/[id]"
	url: string

	// the url pattern to match against. created from './match/parse_page_pattern'
	pattern: RegExp
	// the params used to execute the pattern and extract the variables
	params: readonly RouteParam[]
	// the nullable query variables for this page that aren't satisfied by a route
	// segment. they can be supplied via URLSearchParams and are always optional, so
	// a missing one can never make a query fail (issue #1210).
	searchParams: readonly SearchParam[]

	// loaders for the information that we need to render a page
	// and its loading state
	documents: Record<
		string,
		{
			artifact: () => Promise<{ default: QueryArtifact }>
			loading: boolean
			variables: Record<string, { type: string }>
		}
	>
	component: () => Promise<{ default: _ComponentType }>

	// loaders for the headers() functions exported by this page and its layout
	// chain (outermost first). They are evaluated and merged before streaming so
	// the page wins over layouts and inner layouts win over outer ones.
	headers?: Array<() => Promise<RouteHeaderFunction | undefined>>
}

// a single search-param entry in the manifest: the GraphQL type name (resolved
// against custom scalars in generated code) plus the wrapper chain (outermost
// first) so List-typed variables can round-trip as repeated query keys.
export type SearchParam = {
	name: string
	type: string
	wrappers: readonly string[]
}

// the shape of a route's headers() export: a function returning the response
// headers to merge for the matched page.
export type RouteHeaderFunction = () => RouteHeaders | Promise<RouteHeaders>

export type RouteHeaders = Record<string, string>
