import type { QueryArtifact } from '$houdini/runtime/lib/types'

import { RouteParam } from './match'

// to decide what bundle to load and render for a given url
export type RouterManifest = {
	pages: Record<string, RouterPageManifest>
}

export type RouterPageManifest = {
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
		}
	>
	component: () => Promise<{ default: (props: any) => React.ReactElement }>
}

export type RouterContext = {
	currentRoute: string
	goto: (route: string) => void
}
