import { Config } from 'houdini'

import { parse_page_pattern } from '../../runtime/routing/match'
import { ProjectManifest } from './manifest'

export function print_router_manifest({
	config,
	manifest,
}: {
	config: Config
	manifest: ProjectManifest
}): string {
	// every page in the project manifest needs an entry in the router
	// the entries in the router are described by the RuntimeManifest
	// which is added as part of the runtime transform.

	// we're just going to build up the contents of the file as a
	// string and return it
	return Object.entries(manifest.pages)
		.map(([id, page]) => {
			const parsed = parse_page_pattern(page.url)

			// render the client-side version
			return `"${JSON.stringify(id)}": {
		id: ${JSON.stringify(id)},

		pattern: ${parsed.pattern},
		params: ${JSON.stringify(parsed.params)},

		required_queries: [],

		load_query: {

		},
		load_artifact: {

		},

		load_component: () => import("./")
	}
}`
		})
		.join('\n')
}
