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

// the shape of a route's headers() export: a function returning the response
// headers to merge for the matched page.
export type RouteHeaderFunction = () => RouteHeaders | Promise<RouteHeaders>

export type RouteHeaders = Record<string, string>
