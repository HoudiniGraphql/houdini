import { fs, parseJS, printJS, path, routerConventions } from 'houdini'

import { PageBundleInput } from '.'

/** Generates the component that passes query data to the actual component on the filesystem  */
export async function generate_routing_document_wrappers(args: PageBundleInput) {
	// look up the page manifest
	const layout = routerConventions.is_layout(args.page.path)
	const page = layout ? args.project.layouts[args.id] : args.project.pages[args.id]

	const unit_path = layout
		? routerConventions.layout_unit_path(args.config, args.id)
		: routerConventions.page_unit_path(args.config, args.id)

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
		"import { useQueryResult } from '$houdini/plugins/houdini-react/runtime/routing'",
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
