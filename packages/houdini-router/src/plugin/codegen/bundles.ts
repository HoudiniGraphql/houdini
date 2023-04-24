import { Config, fs, path } from 'houdini'

import { page_bundle_component } from '../conventions'
import { dedent } from '../dedent'
import type { ProjectManifest, PageManifest } from './manifest'

/**
 * Only one page is visible at any given time. This means that the router is basically a big switch
 * statement of patterns to match in order to a single component given some variables.
 *
 * The top level router is responsible for rendering a particular page once it has everything it needs
 * to render a view with the correct data. This means that we have 3 things that we have to load:
 * - the actual data from the api
 * - the actual page source (including layouts)
 * - the artifacts for every query that the page depends on (to process the requests and provide fallback structure)
 *
 * It's imperative that we avoid waterfalls and load all of these things in parallel. This means that
 * we need to generate a file for each part and load them at the same time. Depending on the order in
 * which they resolve, we can render different things. For the rest of the flow, go to the router source.
 */
export async function generate_bundles({
	config,
	manifest,
}: {
	config: Config
	manifest: ProjectManifest
}) {
	// every page needs a bundle directory made
	await Promise.all(
		Object.entries(manifest.pages).map(([id, page]) =>
			generate_page_bundle({ id, page, config, project: manifest })
		)
	)
}

type PageBundleInput = {
	id: string
	page: PageManifest
	project: ProjectManifest
	config: Config
}

async function generate_page_bundle(args: PageBundleInput) {
	const component_path = page_bundle_component(args.config, args.id)

	// the first thing we need to do is make sure that the page has a bundle directory
	await fs.mkdirp(path.dirname(component_path))

	// build up the file source as a string
	let source: string[] = []

	// we need to add imports for every layout
	const layout_components: Record<string, string> = {}
	for (const layout_id of args.page.layouts) {
		const layout = args.project.layouts[layout_id]

		// generate the relative filepath from the component file
		// to the layout
		const layout_path = path.join(
			args.config.pluginDirectory('houdini-router'),
			'..',
			'..',
			'..',
			'src',
			'routes',
			layout.url,
			'+layout'
		)
		const relative_path = path.relative(path.dirname(component_path), layout_path)

		// generate the local name for the layout component
		const component_name = 'Layout_' + layout_id
		layout_components[layout_id] = component_name

		// add the import
		source.push(`import ${component_name} from "${relative_path}"`)
	}

	// generate the relative filepath from the component file
	// to the page
	const page_path = path.join(
		args.config.pluginDirectory('houdini-router'),
		'..',
		'..',
		'..',
		'src',
		'routes',
		args.page.url,
		'+page'
	)
	// generate the local import for the page component
	const relative_path = path.relative(path.dirname(component_path), page_path)
	const page_component = 'Component_' + args.page.id
	source.push(`import ${page_component} from "${relative_path}"`)

	// in order to wrap up the layouts we're going to iterate over the list and build them up
	let content = `<${page_component} ${args.page.queries.map(
		(q) => `${q}={${q}} ${q}$handle={${q}$handle}`
	)} />`
	for (const layout of [...args.page.layouts].reverse()) {
		const Layout = layout_components[layout]
		content = dedent(`<${Layout}>
			${content}
		</${Layout}>
		`)
	}

	// a page's entrypoint should take every query needed by a layout or
	// page and passes it through
	source.push(`export default ({ ${args.page.queries
		.map((q) => [q, `${q}$handle`].join(', '))
		.join('')} }) => (
			${content}
		)`)

	await fs.writeFile(component_path, dedent(source.join('\n')))
}
