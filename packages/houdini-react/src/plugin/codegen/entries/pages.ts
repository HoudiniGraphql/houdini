import { fs, parseJS, printJS, path, routerConventions, type Config } from 'houdini'

import type { PageBundleInput } from '.'

export async function generate_page_entries(args: PageBundleInput) {
	const component_path = routerConventions.page_entry_path(args.config, args.id)

	// the first thing we need to do is make sure that the page has a bundle directory
	await fs.mkdirp(path.dirname(component_path))

	// build up the file source as a string
	let source: string[] = []

	// we need to add imports for every layout
	const layout_components: Record<string, string> = {}
	for (const layout_id of args.page.layouts) {
		// generate the relative filepath from the component file
		// to the layout
		const layout_path = routerConventions.layout_unit_path(args.config, layout_id)
		const relative_path = path.relative(path.dirname(component_path), layout_path)

		// generate the local name for the layout component
		const component_name = 'Layout_' + layout_id
		layout_components[layout_id] = component_name

		// add the import
		source.push(`import ${component_name} from "${relative_path}"`)
	}

	// generate the relative filepath from the component file
	// to the page
	const page_path = routerConventions.page_unit_path(args.config, args.page.id)

	// generate the local import for the page component
	const relative_path = path.relative(path.dirname(component_path), page_path)
	const Component = 'Page_' + args.page.id
	const PageFallback = 'PageFallback_' + args.page.id
	source.push(
		`import ${Component} from "${relative_path}"`,
		`import client from '$houdini/plugins/houdini-react/runtime/client'`
	)

	// in order to wrap up the layouts we're going to iterate over the list and build them up
	let content = `<${Component} />`
	// if the layout has a loading state then wrap it in a fallback
	if (args.project.page_queries[args.page.id]?.loading) {
		const fallback_path = routerConventions.fallback_unit_path(
			args.config,
			'page',
			args.page.id
		)
		source.push(
			`import ${PageFallback}  from "${path.relative(
				path.dirname(page_path),
				fallback_path
			)}"`
		)

		content = `
			<${PageFallback} key={url}>
				${content}
			</${PageFallback}>
		`
	}

	for (const layout of [...args.page.layouts].reverse()) {
		// wrap the content in an instance of the correct component
		const Layout = layout_components[layout]
		content = `
			<${Layout} key={url}>
				${content}
			</${Layout}>
		`

		// if the layout has a loading state then wrap it in a fallback
		if (args.project.layout_queries[layout]?.loading) {
			const LayoutFallback = 'LayoutFallback_' + args.page.id
			const fallback_path = routerConventions.fallback_unit_path(
				args.config,
				'layout',
				args.page.id
			)
			source.push(
				`import ${LayoutFallback}  from "${path.relative(
					page_path,
					path.dirname(fallback_path)
				)}"`
			)

			content = `
				<${LayoutFallback} key={url}>
					${content}
				</${LayoutFallback}>
			`
		}
	}

	source.push(
		// this needs to go at the boundary between the imports and the rest of the content
		componentFieldImports(args.config, component_path, args),
		// a page's entrypoint should take every query needed by a layout or
		// page and passes it through
		`
		export default ({ url }) => {
			return (
				${content}
			)
		}
	`
	)

	// format the source so we don't embarrass ourselves
	const formatted = (await printJS(await parseJS(source.join('\n'), { plugins: ['jsx'] }))).code

	await fs.writeFile(component_path, formatted)
}

function componentFieldImports(config: Config, targetPath: string, args: PageBundleInput) {
	// now that we have every component field requested by the page, we need to
	// add the necssary imports so that vite bundles everything together
	return (
		args.componentFields
			.map((field) => {
				// the path to import from is the path from the entry to the component source
				let componentPathParsed = path.parse(
					path.relative(
						path.dirname(targetPath),
						routerConventions.componentField_unit_path(config, field.fragment)
					)
				)
				let componentPath = path.join(componentPathParsed.dir, componentPathParsed.name)

				// import the component into the local scope
				return `import ${field.fragment} from '${componentPath}'`
			})
			.join('\n') +
		`

if (globalThis.window) {
	let target = globalThis.window.__houdini__client__? globalThis.window.__houdini__client__.componentCache : null
	if (!globalThis.window.__houdini__client__) {
		if (!window.__houdini__pending_components__) {
			window.__houdini__pending_components__ = {}
		}

		target = window.__houdini__pending_components__
	}

	${args.componentFields
		.map((field) => `    target["${field.type}.${field.field}"] = ${field.fragment}`)
		.join('\n')}
}
`
	)
}
