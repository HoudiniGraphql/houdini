import {
	fs,
	parseJS,
	printJS,
	path,
	routerConventions,
	processComponentFieldDirective,
	type Config,
	type ProjectManifest,
	type Document,
} from 'houdini'

import { PageBundleInput } from '.'

export function generate_routing_document_wrappers({
	manifest,
	config,
	documents,
}: {
	manifest: ProjectManifest
	config: Config
	documents: Record<string, Document>
}) {
	// we need to generate wrappers for every query in the project
	const queries = Object.entries(manifest.pages).concat(Object.entries(manifest.layouts))

	// the component fields need a wrapper too that actually calls useFragment
	const componentFields = Object.entries(config.componentFields).flatMap(([typeName, fields]) =>
		Object.entries(fields).flatMap(([fieldName, { directive, ...data }]) => ({
			...data,
			...processComponentFieldDirective(directive),
			type: typeName,
			field: fieldName,
		}))
	)

	return Promise.all(
		queries
			.map(([id, page]) =>
				generate_query_wrapper({
					id,
					page,
					config,
					project: manifest,
					componentFields: [],
					documents,
				})
			)
			.concat(
				componentFields.map((field) =>
					generate_component_field_wrapper({ config, field, documents })
				)
			)
	)
}

/** Generates the component that passes query data to the actual component on the filesystem  */
async function generate_query_wrapper(args: PageBundleInput) {
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
	const formatted = (await printJS(parseJS(source.join('\n'), { plugins: ['jsx'] }))).code

	await fs.writeFile(unit_path, formatted)
}

async function generate_component_field_wrapper({
	config,
	field,
	documents,
}: {
	config: Config
	field: {
		type: string
		field: string
		export?: string | undefined
		prop: string
		fragment: string
		filepath: string
	}
	documents: Record<string, Document>
}) {
	// the local variable we will use as the component name
	const localName = 'Component'

	// compute the path we will write to
	const targetPath = routerConventions.componentField_unit_path(config, field.fragment)

	// the first thing we need to do is make sure that the page has a bundle directory
	await fs.mkdirp(path.dirname(targetPath))

	// if the component is a named export, use that
	// otherwise just use the default export
	const importStatment = field.export ? `{ ${field.export} as ${localName} }` : localName

	// the path to import from is the path from the entry to the component source
	let componentPathParsed = path.parse(path.relative(path.dirname(targetPath), field.filepath))
	let componentPath = path.join(componentPathParsed.dir, componentPathParsed.name)

	// the set of things we want to import as a provided key
	const imports: Record<string, string> = {
		artifact: config.artifactImportPath(field.fragment),
	}

	// build up the tag we will use where we normally pass the graphql tag
	let tagValue = `{
		artifact,`

	// if the fragment needs a refetch artifact we'll pass that too
	const fragmentDocument = documents[field.fragment]
	if (!fragmentDocument) {
		return
	}
	if (config.needsRefetchArtifact(fragmentDocument.document)) {
		tagValue += `
		refetchArtifact,`

		// add the refetch artifact to the list of imports
		imports['refetchArtifact'] = config.artifactImportPath(
			config.paginationQueryName(field.fragment)
		)
	}
	// close the tagValue
	tagValue += `
}`

	// a component field wrapper is responsible for calling the appropriate fragment hook
	// and passing the result to the component as the correct prop
	let content = `import { useFragment } from '$houdini'
import ${importStatment} from '${componentPath}'
${Object.entries(imports)
	.map(([key, path]) => `import ${key} from '${path}'`)
	.join('\n')}

export default ({ ${field.prop}, ...props }) => {
	const value = useFragment(${field.prop}, ${tagValue})

	return <${localName} ${field.prop}={value} {...props} />
}
`

	await fs.writeFile(targetPath, content)
}
