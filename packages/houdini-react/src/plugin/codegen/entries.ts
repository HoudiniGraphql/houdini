import { type Config, fs, parseJS, printJS, path } from 'houdini'

import {
	page_entry_path,
	page_unit_path,
	layout_unit_path,
	is_layout,
	fallback_unit_path,
} from '../conventions'
import type { ProjectManifest, PageManifest, QueryManifest } from './manifest'

export async function generate_entries({
	config,
	manifest,
}: {
	config: Config
	manifest: ProjectManifest
}) {
	await Promise.all([
		...Object.entries(manifest.pages).map(([id, page]) =>
			generate_page_entries({ id, page, config, project: manifest })
		),
		...Object.entries(manifest.pages)
			.concat(Object.entries(manifest.layouts))
			.map(([id, page]) => generate_routing_units({ id, page, config, project: manifest })),
		generate_fallbacks({ config, project: manifest }),
	])
}

type PageBundleInput = {
	id: string
	page: PageManifest
	project: ProjectManifest
	config: Config
}

/** Generates the component that passes query data to the actual component on the filesystem  */
async function generate_routing_units(args: PageBundleInput) {
	// look up the page manifest
	const layout = is_layout(args.page.path)
	const page = layout ? args.project.layouts[args.id] : args.project.pages[args.id]

	const unit_path = layout
		? layout_unit_path(args.config, args.id)
		: page_unit_path(args.config, args.id)

	// the first thing we need to do is make sure that the page has a bundle directory
	await fs.mkdirp(path.dirname(unit_path))

	// compute the import path from this component to the user's project
	const page_path = path.join(
		args.config.pluginDirectory('houdini-router'),
		'..',
		'..',
		'..',
		'src',
		'routes',
		page.url,
		'+' + (layout ? 'layout' : 'page')
	)
	const relative_path = path.relative(path.dirname(unit_path), page_path)

	// generate the local name for the layout component
	const component_name = 'Component_' + page.id

	// build up the file source as a string
	let source: string[] = [
		"import { useQueryResult } from '$houdini/plugins/houdini-react/runtime/routing/components/Router'",
		`import ${component_name} from "${relative_path}"`,
	]

	source.push(`export default ({ children }) => {
		${/* Grab references to every query we need*/ ''}
		${page.queries
			.map((query) => `const [${query}$data, ${query}$handle] = useQueryResult("${query}")`)
			.join('\n')}

		return (
			<${component_name}
			${page.queries
				.map((query) =>
					[`${query}={${query}$data}`, `${query}$handle={${query}$handle}`].join(' ')
				)
				.join('\n')}
			>
				{children}
			</${component_name}>
		)
	}`)

	// format the source so we don't embarrass ourselves
	const formatted = (await printJS(await parseJS(source.join('\n'), { plugins: ['jsx'] }))).code

	await fs.writeFile(unit_path, formatted)
}

async function generate_page_entries(args: PageBundleInput) {
	const component_path = page_entry_path(args.config, args.id)

	// the first thing we need to do is make sure that the page has a bundle directory
	await fs.mkdirp(path.dirname(component_path))

	// build up the file source as a string
	let source: string[] = []

	// we need to add imports for every layout
	const layout_components: Record<string, string> = {}
	for (const layout_id of args.page.layouts) {
		// generate the relative filepath from the component file
		// to the layout
		const layout_path = layout_unit_path(args.config, layout_id)
		const relative_path = path.relative(path.dirname(component_path), layout_path)

		// generate the local name for the layout component
		const component_name = 'Layout_' + layout_id
		layout_components[layout_id] = component_name

		// add the import
		source.push(`import ${component_name} from "${relative_path}"`)
	}

	// generate the relative filepath from the component file
	// to the page
	const page_path = page_unit_path(args.config, args.page.id)

	// generate the local import for the page component
	const relative_path = path.relative(path.dirname(component_path), page_path)
	const Component = 'Page_' + args.page.id
	const PageFallback = 'PageFallback_' + args.page.id
	source.push(`import ${Component} from "${relative_path}"`)

	// in order to wrap up the layouts we're going to iterate over the list and build them up
	let content = `<${Component} />`
	// if the layout has a loading state then wrap it in a fallback
	if (args.project.page_queries[args.page.id]?.loading) {
		const fallback_path = fallback_unit_path(args.config, 'page', args.page.id)
		source.push(
			`import ${PageFallback}  from "${path.relative(
				path.dirname(page_path),
				fallback_path
			)}"`
		)

		content = `
			<${PageFallback}>
				${content}
			</${PageFallback}>
		`
	}

	for (const layout of [...args.page.layouts].reverse()) {
		// wrap the content in an instance of the correct component
		const Layout = layout_components[layout]
		content = `
			<${Layout}>
				${content}
			</${Layout}>
		`

		// if the layout has a loading state then wrap it in a fallback
		if (args.project.layout_queries[layout]?.loading) {
			const LayoutFallback = 'LayoutFallback_' + args.page.id
			const fallback_path = fallback_unit_path(args.config, 'layout', args.page.id)
			source.push(
				`import ${LayoutFallback}  from "${path.relative(
					page_path,
					path.dirname(fallback_path)
				)}"`
			)

			content = `
				<${LayoutFallback}>
					${content}
				</${LayoutFallback}>
			`
		}
	}

	// a page's entrypoint should take every query needed by a layout or
	// page and passes it through
	source.push(`
		export default () => {
			return (
				${content}
			)
		}
	`)

	// format the source so we don't embarrass ourselves
	const formatted = (await printJS(await parseJS(source.join('\n'), { plugins: ['jsx'] }))).code

	await fs.writeFile(component_path, formatted)
}

async function generate_fallbacks({
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
		const layout = is_layout(page.path)
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

		const fallback_path = fallback_unit_path(config, which, id)
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
			"import { useRouterContext, useCache, useQueryResult } from '$houdini/plugins/houdini-react/runtime/routing/components/Router'",
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
