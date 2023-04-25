import { Config, path } from 'houdini'

import { parse_page_pattern } from '../../runtime/routing/match'
import { page_bundle_component } from '../conventions'
import { dedent } from '../dedent'
import { ProjectManifest } from './manifest'

export function format_router_manifest({
	config,
	manifest,
	exportDefaultStatement,
}: {
	config: Config
	manifest: ProjectManifest
	exportDefaultStatement: (name: string) => string
	importStatement: (from: string, as: string) => string
}): string {
	// every page in the project manifest needs an entry in the router
	// the entries in the router are described by the RuntimeManifest
	// which is added as part of the runtime transform.

	// when computing relative paths, this is the current directory
	const from = '$houdini/plugins/houdini-router/runtime'

	// we're just going to build up the contents of the file as a
	// string and return it
	return exportDefaultStatement(
		`{
			pages: {
${Object.entries(manifest.pages)
	.map(([id, page]) => {
		// parse the url pattern
		const pattern_parsed = parse_page_pattern(page.url)

		let component_path = path.join(page_bundle_component(config, id, '..'))
		const path_parsed = path.parse(component_path)
		component_path = path.join(path_parsed.dir, path_parsed.name)

		// render the client-side version
		return dedent(
			'		',
			`
	${JSON.stringify(id)}: {
		id: ${JSON.stringify(id)},
		pattern: ${pattern_parsed.pattern},
		params: ${JSON.stringify(pattern_parsed.params)},

		required_queries: ${JSON.stringify(page.queries)},

		${/* Every query that the page relies on needs an artifact */ ' '.trim()}
		documents: {
			${page.queries
				.map((query) => {
					// we need to compute the relative path to the artifact
					const artifact_path = config.artifactImportPath(query)

					return `${query}: () => import("${path.relative(from, artifact_path)}")`
				})
				.join(',\n			')}
		},

		component: () => import("${component_path}")
	},`
		)
	})
	.join('\n\n')}
	},

	layouts: {
${Object.entries(manifest.layouts)
	.map(([id, layout]) => {
		return dedent(
			'		',
			`
	${JSON.stringify(id)}: {
		id: ${JSON.stringify(id)},

		required_queries: ${JSON.stringify(layout.queries)},
	}`
		)
	})
	.join(',\n')}
	}
}`
	)
}
