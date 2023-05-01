import { Config, fs, parseJS, printJS, path } from 'houdini'

import { page_entry_path, page_unit_path, layout_unit_path } from '../conventions'
import type { ProjectManifest, PageManifest } from './manifest'

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
	const layout = args.page.path.endsWith('+layout.tsx') || args.page.path.endsWith('+layout.jsx')
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
		'+' + layout ? 'layout' : 'page'
	)
	const relative_path = path.relative(path.dirname(unit_path), page_path)

	// generate the local name for the layout component
	const component_name = 'Component_' + page.id

	// build up the file source as a string
	let source: string[] = [
		"import { useDocumentStore } from '$houdini/plugins/houdini-react/runtime/routing/components/Router'",
		`import ${component_name} from "${relative_path}"`,
	]

	source.push(`export default ({ children }) => {
		${/* Grab references to every query we need*/ ''}
		${page.queries
			.map((query) => `const [${query}$data, ${query}$handle] = useDocumentStore("${query}")`)
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
	let source: string[] = [
		"import { Page, Fallback } from '$houdini/plugins/houdini-react/runtime/routing/components'",
	]

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
	source.push(`import ${Component} from "${relative_path}"`)

	// in order to wrap up the layouts we're going to iterate over the list and build them up
	let content = `<${Component} />`
	// if the layout has a loading state then wrap it in a fallback
	if (args.project.page_queries[args.page.id]?.loading) {
		content = `
			<Fallback Component={${Component}} queries={${JSON.stringify(args.page.queries)}}>
				${content}
			</Fallback>
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
			// make sure to pass the right props to the component
			const props = `Component={} queries={${JSON.stringify(
				args.project.layouts[layout].queries
			)}}`

			content = `
				<Fallback ${props}>
					${content}
				</Fallback>
			`
		}
	}

	// a page's entrypoint should take every query needed by a layout or
	// page and passes it through
	source.push(`
		export default () => (
			${content}
		)
	`)

	// format the source so we don't embarrass ourselves
	const formatted = (await printJS(await parseJS(source.join('\n'), { plugins: ['jsx'] }))).code

	await fs.writeFile(component_path, formatted)
}
