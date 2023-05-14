import { Config, path, fs } from 'houdini'

import { dedent } from '../dedent'
import { PageManifest, ProjectManifest } from './manifest'

export async function generate_type_root({
	config,
	manifest,
}: {
	config: Config
	manifest: ProjectManifest
}) {
	// every page and layout needs an entry in the type root so that
	// users can always import from ./$types
	//
	// page props get exported as PageProps
	// layout props get exported as LayoutProps

	// the project's manifest already has all of the information we need
	// but we need to group pages and sibling layouts so we can generate
	// a single file (since users always import from './$types')

	const pages: Record<string, { page?: PageManifest; layout?: PageManifest }> = {}
	for (const page of Object.values(manifest.layouts)) {
		const page_path = path.relative(config.projectRoot, page.path)
		pages[page_path] = {
			...pages[page_path],
			layout: page,
		}
	}
	for (const page of Object.values(manifest.pages)) {
		const page_path = path.relative(config.projectRoot, page.path)
		pages[page_path] = {
			...pages[page_path],
			page: page,
		}
	}

	await Promise.all(
		Object.entries(pages).map(async ([relative_path, { page, layout }]) => {
			// the type root must mirror the source tree
			const target_path = path.join(config.typeRootDir, relative_path)
			const target_dir = path.dirname(target_path)
			// make sure the necessary directories exist
			await fs.mkdirp(target_dir)

			const all_queries = (page?.query_options ?? []).concat(layout?.query_options ?? [])

			// compute the path prefix to bring us to the root of the $houdini directory
			const relative = path.relative(target_dir, config.rootDir)

			// build up the type definitions
			const definition = `
import { DocumentHandle } from '${relative}/plugins/houdini-react/runtime'

${
	/* every dependent query needs to be imported */
	all_queries
		.map((query) =>
			dedent(`
            import type { ${query}$result, ${query}$artifact, ${query}$input } from '${config
				.artifactImportPath(query)
				.replace('$houdini', relative)}'

        `)
		)
		.join('\n')
}

${
	/* if there is a page, then we need to define the props object */
	!page
		? ''
		: `
export type PageProps = {
${page.query_options
	.map(
		(query) =>
			`    ${query}: ${query}$result,
    ${query}$handle: DocumentHandle<${query}$artifact, ${query}$result, ${query}$input>,`
	)
	.join('\n')}
}
`
}

${
	/* if there is a layout, then we need to define the props object */
	!layout
		? ''
		: `
export type LayoutProps = {
${layout.query_options
	.map(
		(query) =>
			`    ${query}: ${query}$result,
    ${query}$handle: DocumentHandle<${query}$artifact, ${query}$result, ${query}$input>,`
	)
	.join('\n')}
}
`
}


`

			await fs.writeFile(path.join(target_dir, '$types.d.ts'), definition)
		})
	)
}
