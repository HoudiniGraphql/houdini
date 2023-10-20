import {
	type Config,
	fs,
	parseJS,
	printJS,
	path,
	routerConventions,
	type ProjectManifest,
	type QueryManifest,
} from 'houdini'

export async function generate_fallbacks({
	config,
	project,
}: {
	config: Config
	project: ProjectManifest
}) {
	const query_map = Object.values(project.layout_queries)
		.concat(Object.values(project.page_queries))
		.reduce(
			(prev, query) => ({ ...prev, [query.name]: query }),
			{} as Record<string, QueryManifest>
		)

	// look at every page and figure out if it needs a layout
	for (const [id, page] of Object.entries(project.layouts).concat(
		Object.entries(project.pages)
	)) {
		const layout = routerConventions.is_layout(page.path)
		const which = layout ? 'layout' : 'page'

		// in order to generate the fallback, we need to know which queries are
		// required and which can get loading states
		const { required_queries, loading_queries } = page.queries.reduce(
			(prev, query) => {
				// look up the query
				if (query_map[query].loading) {
					prev.loading_queries.push(query)
				} else {
					prev.required_queries.push(query)
				}

				return prev
			},
			{ required_queries: [] as string[], loading_queries: [] as string[] }
		)

		const fallback_path = routerConventions.fallback_unit_path(config, which, id)
		const page_path = path.join(
			config.pluginDirectory('houdini-router'),
			'..',
			'..',
			'..',
			'src',
			'routes',
			page.url,
			'+' + (layout ? 'layout' : 'page')
		)

		// the first thing we need to do is make sure that the page has a bundle directory
		await fs.mkdirp(path.dirname(fallback_path))

		// build up the file source as a string
		let source: string[] = [
			"import { useRouterContext, useCache, useQueryResult } from '$houdini/plugins/houdini-react/runtime/routing/Router'",
			`import Component from '${page_path}'`,
			"import { Suspense } from 'react'",
		]

		// the default export for the fallback suspends while it waits for the necessary
		// artifacts and then wraps the children in a suspense boundary with a fallback
		// that renders the component with its loading state
		source.push(
			`
			export default ({ children }) => {
				const { artifact_cache } = useRouterContext()

				${/* Grab references to every query we need*/ ''}
				${page.queries
					.map((query) => `const ${query}_artifact = artifact_cache.get("${query}")`)
					.join('\n')}

				${/* Make sure all of the required queries have resolved */ ''}
				${required_queries
					.map(
						(query) =>
							`const [${query}_data, ${query}_handle] = useQueryResult("${query}")`
					)
					.join('\n')}

				return (
					<Suspense fallback={
						<Fallback
							required_queries={{${required_queries.map((q) => `${q}: ${q}_data `).join(',')}}}
							loading_queries={{${loading_queries.map((q) => `${q}: ${q}_artifact `).join(',')}}}
						/>
					}>
						{children}
					</Suspense>
				)
			}
		`,
			// in order to avoid necessarily computing the loading state, we're going to do that in
			// a separate function so that the computation only triggers when it mounts
			`
			const Fallback = ({ required_queries, loading_queries }) => {
				const cache = useCache()

				let props = Object.entries(loading_queries).reduce((prev, [name, artifact]) => ({
					...prev,
					[name]: cache.read({
						selection: artifact.selection,
						loading: true,
					}).data
				}), required_queries)

				return <Component {...props} />
			}
		`
		)

		// format the source so we don't embarrass ourselves
		const formatted = (await printJS(await parseJS(source.join('\n'), { plugins: ['jsx'] })))
			.code

		await fs.writeFile(fallback_path, formatted)
	}
}
