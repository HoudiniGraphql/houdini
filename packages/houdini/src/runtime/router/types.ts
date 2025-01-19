import type { QueryArtifact } from '$houdini/runtime/lib/types'
import type { createYoga } from 'graphql-yoga'

import type { RouteParam } from './match'

export type YogaServer = ReturnType<typeof createYoga>
export type YogaServerOptions = Parameters<typeof createYoga>[0]

// to decide what bundle to load and render for a given url
export type RouterManifest<_ComponentType> = {
	pages: Record<string, RouterPageManifest<_ComponentType>>
}

export type { ServerAdapterFactory } from './server'

export type RouterPageManifest<_ComponentType> = {
	id: string

	// the url pattern to match against. created from './match/parse_page_pattern'
	pattern: RegExp
	// the params used to execute the pattern and extract the variables
	params: RouteParam[]

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
}
