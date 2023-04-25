import { Config, fs, parseJS, printJS, path } from 'houdini'

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
	const Component = 'Component_' + args.page.id
	source.push(`import ${Component} from "${relative_path}"`)

	// in order to wrap up the layouts we're going to iterate over the list and build them up
	let content = `<${Component} ${query_with_props({
		queries: args.page.queries,
		value: true,
	})} />`
	for (const layout of [...args.page.layouts].reverse()) {
		// wrap the content in an instance of the correct component
		const Layout = layout_components[layout]

		const props = query_with_props({
			queries: args.project.layouts[layout].queries,
			value: true,
			betweenPairs: ' ',
		})
		// make sure to pass the right props to the component
		content = `
			<${Layout} ${props}>
				${content}
			</${Layout}>
		`
	}

	// the full list of queries is the page queries and the layout queries
	const queries = args.page.queries.concat(
		...args.page.layouts.map((l) => args.project.layouts[l].queries)
	)

	// a page's entrypoint should take every query needed by a layout or
	// page and passes it through
	source.push(`
		export default ({ 
			${query_with_props({
				queries,
				betweenValues: ',',
			})} 
		}) => (
			${content}
		)
	`)

	// format the source so we don't embarrass ourselves
	const formatted = (await printJS(await parseJS(source.join('\n'), { plugins: ['jsx'] }))).code

	await fs.writeFile(component_path, formatted)
}

const query_with_props = ({
	queries,
	value,
	betweenValues = ' ',
	betweenPairs = ', ',
}: {
	queries: string[]
	value?: boolean
	betweenValues?: string
	betweenPairs?: string
}) =>
	queries
		.map(
			(q) =>
				`${q}${value ? `={${q}}` : ''}${betweenValues}${q}$handle${
					value ? `={${q}$handle}` : ''
				}`
		)
		.join(betweenPairs)
