import * as graphql from 'graphql'
import {
	fs,
	parseJS,
	printJS,
	path,
	routerConventions,
	processComponentFieldDirective,
	Config,
} from 'houdini'

import { PageBundleInput } from '.'

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
	source.push(`import ${Component} from "${relative_path}"`)

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

	// this needs to go at the boundary between the imports and the rest of the content
	source.push(componentFieldImports(component_path, args))

	// a page's entrypoint should take every query needed by a layout or
	// page and passes it through
	source.push(`
		export default ({ url }) => {
			return (
				${content}
			)
		}
	`)

	// format the source so we don't embarrass ourselves
	const formatted = (await printJS(await parseJS(source.join('\n'), { plugins: ['jsx'] }))).code

	await fs.writeFile(component_path, formatted)
}

function componentFieldImports(targetPath: string, args: PageBundleInput) {
	// we need to find the list of component fields that
	let componentFields: (ReturnType<typeof processComponentFieldDirective> &
		Config['componentFields'][string][string] & {
			type: string
		})[] = []

	// we need to get the flat list of every query that's used in the page and its layouts
	const queries = args.page.queries.concat(
		args.page.layouts.flatMap((layout) => args.project.layouts[layout].queries)
	)

	// go through the documents once, looking for the ones we care about
	for (const document of args.documents) {
		// if the document isn't one of the queries we used, skip it
		if (!queries.includes(document.name)) {
			continue
		}

		// we know the document has components so we need to look at every field
		const typeInfo = new graphql.TypeInfo(args.config.schema)
		graphql.visit(
			document.document,
			graphql.visitWithTypeInfo(typeInfo, {
				FragmentSpread(node) {
					// if the spread is marked as a component field then
					// add it to the list
					const directive = node.directives?.find(
						(directive) => directive.name.value === args.config.componentFieldDirective
					)
					if (directive) {
						// find the args we care about
						const { field } = processComponentFieldDirective(directive)
						const type = typeInfo.getParentType()?.name
						if (!field || !type || !args.config.componentFields[type]?.[field]) {
							return
						}

						// add the component field metadata to the list
						componentFields.push({
							type,
							...args.config.componentFields[type][field],
							...processComponentFieldDirective(directive),
						})
					}
				},
			})
		)
	}

	// now that we have every component field requested by the page, we need to
	// add the necssary imports so that vite bundles everything together
	return (
		componentFields
			.map((field) => {
				// if the component is a named export, use that
				// otherwise just use the default export
				const importStatment = field.export
					? `{ ${field.export} as ${field.fragment} }`
					: field.fragment

				// the path to import from is the path from the entry to the component source
				let componentPathParsed = path.parse(
					path.relative(path.dirname(targetPath), field.filepath)
				)
				let componentPath = path.join(componentPathParsed.dir, componentPathParsed.name)

				// import the component into the local scope
				return `import ${importStatment} from '${componentPath}'`
			})
			.join('\n') +
		`
if (!window?.__houdini__component_cache__) {
	if (window) {
		window.__houdini__component_cache__ = {}
	}
}

if (window) {
${componentFields
	.map(
		(field) =>
			`    window.__houdini__component_cache__["${field.type}.${field.field}"] = ${field.fragment}`
	)
	.join('\n')}
}
`
	)
}
