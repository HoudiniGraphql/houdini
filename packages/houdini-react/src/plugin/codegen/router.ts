import { Config, path } from 'houdini'

import { parse_page_pattern } from '../../runtime/routing/lib/match'
import { page_entry_path } from '../conventions'
import { dedent } from '../dedent'
import { ProjectManifest, QueryManifest } from './manifest'

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

		let component_path = path.join(page_entry_path(config, page.id, '..'))
		const path_parsed = path.parse(component_path)
		component_path = path.join(path_parsed.dir, path_parsed.name)

		// the list of queries that the page cares about
		const queries = [
			...new Set(
				page.queries.concat(
					page.layouts.flatMap((layout) => manifest.layouts[layout].queries)
				)
			),
		]

		const query_name_map = Object.values(manifest.page_queries)
			.concat(Object.values(manifest.layout_queries))
			.reduce<Record<string, QueryManifest>>(
				(map, q) => ({
					...map,
					[q.name]: q,
				}),
				{}
			)

		// render the client-side version
		return dedent(
			'		',
			`
	${JSON.stringify(id)}: {
		id: ${JSON.stringify(id)},
		pattern: ${pattern_parsed.pattern},
		params: ${JSON.stringify(pattern_parsed.params)},

		${/* Every query that the page relies on needs an artifact */ ''}
		documents: {
			${queries
				.map((query) => {
					// we need to compute the relative path to the artifact
					const artifact_path = config.artifactImportPath(query)

					return `${query}: {
						artifact: () => import("${path.relative(from, artifact_path)}"),
						loading: ${JSON.stringify(query_name_map[query]?.loading)}
					}`
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

		queries: ${JSON.stringify(layout.queries)},
	}`
		)
	})
	.join(',\n')}
	}
}`
	)
}
