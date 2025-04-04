import * as graphql from 'graphql'
import type { Config } from 'houdini'
import { find_graphql, fs, path } from 'houdini'
import { ensure_imports } from 'houdini/vite'
import type * as recast from 'recast'

import { plugin_config } from './config'
import { parseSvelte } from './extract'
import { extract_load_function } from './extractLoadFunction'
import { store_import_path, store_name } from './storeConfig'
import type { SvelteTransformPage } from './transforms/types'

type Identifier = recast.types.namedTypes.Identifier

// compute if a path points to a component query or not
export function is_route(config: Config, framework: Framework, filepath: string): boolean {
	// a vanilla svelte app is never considered in a route
	if (framework === 'svelte') {
		return false
	}

	if (
		!filepath.startsWith(config.routesDir) &&
		!filepath.startsWith(path.join(config.projectRoot, config.routesDir))
	) {
		return false
	}

	// only consider layouts and pages as routes
	return ['+layout.svelte', '+page.svelte'].includes(path.parse(filepath).base)
}

export function route_data_path(config: Config, filename: string) {
	// replace the .svelte with .js
	return resolve_relative(config, filename).replace('.svelte', '.js')
}

export function routePagePath(config: Config, filename: string) {
	return resolve_relative(config, filename).replace('.js', '.svelte').replace('.ts', '.svelte')
}

export function is_route_script(framework: Framework, filename: string) {
	return is_page_script(framework, filename) || is_layout_script(framework, filename)
}

export function is_page_script(framework: Framework, filename: string) {
	return framework === 'kit' && (filename.endsWith('+page.js') || filename.endsWith('+page.ts'))
}

export function is_layout_script(framework: Framework, filename: string) {
	return (
		framework === 'kit' && (filename.endsWith('+layout.js') || filename.endsWith('+layout.ts'))
	)
}

export function is_root_layout(config: Config, filename: string) {
	return (
		resolve_relative(config, filename).replace(config.projectRoot, '') ===
		path.sep + path.join('src', 'routes', '+layout.svelte')
	)
}

export function is_root_layout_server(config: Config, filename: string) {
	return (
		resolve_relative(config, filename).replace(config.projectRoot, '').replace('.ts', '.js') ===
		path.sep + path.join('src', 'routes', '+layout.server.js')
	)
}

export function is_root_layout_script(config: Config, filename: string) {
	return (
		resolve_relative(config, filename).replace(config.projectRoot, '').replace('.ts', '.js') ===
		path.sep + path.join('src', 'routes', '+layout.js')
	)
}

export function is_layout_component(framework: Framework, filename: string) {
	return framework === 'kit' && filename.endsWith('+layout.svelte')
}

export function is_page_component(framework: Framework, filename: string) {
	return framework === 'kit' && filename.endsWith('+page.svelte')
}

export function is_layout(framework: Framework, filename: string) {
	return is_layout_script(framework, filename) || is_layout_component(framework, filename)
}

export function is_component(config: Config, framework: Framework, filename: string) {
	return (
		framework === 'svelte' ||
		(filename.endsWith('.svelte') &&
			!is_route_script(framework, filename) &&
			!is_route(config, framework, filename))
	)
}

export function page_query_path(config: Config, filename: string) {
	return path.join(
		path.dirname(resolve_relative(config, filename)),
		plugin_config(config).pageQueryFilename
	)
}

export function layout_query_path(config: Config, filename: string) {
	return path.join(
		path.dirname(resolve_relative(config, filename)),
		plugin_config(config).layoutQueryFilename
	)
}

export function resolve_relative(config: Config, filename: string) {
	// kit generates relative import for our generated files. we need to fix that so that
	// vites importer can find the file.
	const match = filename.match('^((../)+)src/routes')
	if (match) {
		filename = path.join(config.projectRoot, filename.substring(match[1].length))
	}

	return filename
}

export async function walk_routes(
	config: Config,
	framework: Framework,
	visitor: RouteVisitor,
	dirpath = config.routesDir
) {
	let pageExports: string[] = []
	let layoutExports: string[] = []
	let pageQueries: graphql.OperationDefinitionNode[] = []
	let layoutQueries: graphql.OperationDefinitionNode[] = []
	let componentQueries: {
		query: graphql.OperationDefinitionNode
		componentPath: string
	}[] = []

	let validRoute = false

	//parse all files and push contents into page/layoutExports, page/layoutQueries
	for (const child of await fs.readdir(dirpath)) {
		const childPath = path.join(dirpath, child)
		// if we run into another directory, keep walking down
		if ((await fs.stat(childPath)).isDirectory()) {
			await walk_routes(config, framework, visitor, childPath)
			//ensure that directories are not passed to route func, pass directory and then skip to next file
			continue
		}

		//maybe turn into switch-case statement?
		if (is_layout_script(framework, childPath)) {
			validRoute = true
			const { houdini_load, exports } = await extract_load_function(config, childPath)

			// mutate with optional layoutQueries. Takes in array of OperationDefinitionNodes
			await visitor.layoutQueries?.(houdini_load ?? [], childPath)
			// push all queries to our layoutQueries
			layoutQueries.push(...(houdini_load ?? []))

			// mutate with optional layoutExports. Takes in array of strings
			await visitor.layoutExports?.(exports, childPath)
			// push all exports to our layoutExports
			layoutExports.push(...exports)
		} else if (is_page_script(framework, childPath)) {
			validRoute = true
			const { houdini_load, exports } = await extract_load_function(config, childPath)

			// mutate with optional pageQueries. Takes in array of OperationDefinitionNodes
			await visitor.pageQueries?.(houdini_load ?? [], childPath)
			// push all queries to our pageQueries
			pageQueries.push(...(houdini_load ?? []))

			// mutate with optional pageExports. Takes in array of strings
			await visitor.pageExports?.(exports, childPath)
			// push all exports to our pageExports
			pageExports.push(...exports)
		} else if (is_layout_component(framework, childPath)) {
			validRoute = true
			const contents = await fs.readFile(childPath)
			if (!contents) {
				continue
			}
			const parsed = await parseSvelte(contents, plugin_config(config).forceRunesMode)
			if (!parsed) {
				continue
			}

			const { script } = parsed

			await find_graphql(config, script, {
				where: (tag) => {
					try {
						return !!config.extractQueryDefinition(tag)
					} catch {
						return false
					}
				},
				tag: async ({ parsedDocument }) => {
					let definition = config.extractQueryDefinition(parsedDocument)

					// mutate with optional inlineLayoutQuery. Takes an OperationDefinitionNode
					await visitor.inlineLayoutQueries?.(definition, childPath)
					// We push this to layoutQueries since it will be the same in the type file anyway
					layoutQueries.push(definition)
				},
			})
		} else if (is_page_component(framework, childPath)) {
			validRoute = true
			const contents = await fs.readFile(childPath)
			if (!contents) {
				continue
			}
			const parsed = await parseSvelte(contents, plugin_config(config).forceRunesMode)
			if (!parsed) {
				continue
			}

			const { script } = parsed

			// look for any graphql tags and push into queries.
			await find_graphql(config, script, {
				where: (tag) => {
					try {
						return !!config.extractQueryDefinition(tag)
					} catch {
						return false
					}
				},
				tag: async ({ parsedDocument }) => {
					let definition = config.extractQueryDefinition(parsedDocument)
					// mutate with optional inlinePageQuery. Takes an OperationDefinitionNode
					await visitor.inlinePageQueries?.(definition, childPath)
					// We push this to pageQueries since it will be the same in the type file anyway
					pageQueries.push(definition)
				},
			})
		} else if (is_component(config, framework, childPath)) {
			validRoute = true
			const contents = await fs.readFile(childPath)
			if (!contents) {
				continue
			}
			const parsed = await parseSvelte(contents, plugin_config(config).forceRunesMode)
			if (!parsed) {
				continue
			}

			const { script } = parsed

			// look for any graphql tags and push into queries.
			await find_graphql(config, script, {
				where: (tag) => {
					try {
						return !!config.extractQueryDefinition(tag)
					} catch {
						return false
					}
				},
				tag: async ({ parsedDocument }) => {
					let definition = config.extractQueryDefinition(parsedDocument)
					// mutate with optional inlinePageQuery. Takes an OperationDefinitionNode
					await visitor.routeComponentQuery?.(definition, childPath)
					// we need to push this to a separate array as we need to generate different types for this
					componentQueries.push({ query: definition, componentPath: childPath })
				},
			})
		} else if (child === plugin_config(config).layoutQueryFilename) {
			validRoute = true
			const contents = await fs.readFile(childPath)
			if (!contents) {
				continue
			}
			//parse content
			try {
				const query = config.extractQueryDefinition(graphql.parse(contents))
				// mutate with optional routeLayoutQuery. Takes an OperationDefinitionNode
				await visitor.routeLayoutQuery?.(query, childPath)
				// push to layoutQueries since once again adding to same file anyway
				layoutQueries.push(query)
			} catch (e) {
				throw routeQueryError(childPath)
			}
		} else if (child === plugin_config(config).pageQueryFilename) {
			validRoute = true
			const contents = await fs.readFile(childPath)
			if (!contents) {
				continue
			}

			try {
				const query = config.extractQueryDefinition(graphql.parse(contents))
				// mutate with optional routePageQuery. Takes an OperationDefinitionNode
				await visitor.routePageQuery?.(query, childPath)
				// push to pageQueries since once again adding to same file anyway
				pageQueries.push(query)
			} catch (e) {
				throw routeQueryError(childPath)
			}
		} else {
			continue
		}
	}

	// if length of any field is greater than 0, we run our route.
	// pageExports can be defined where queries aren't
	// e.g. QueryVariables but uses parent dirs layoutQuery (probably a bad idea)
	if (visitor.route && validRoute) {
		//NOTE: Define sveltekitTypeFilePath here so that we ensure route is valid

		const relative_path_regex = /src(.*)/

		// here we define the location of the correspoding sveltekit type file
		const local = dirpath.replace(config.projectRoot, '')
		const svelteTypeFilePath = path.join(
			config.projectRoot,
			'.svelte-kit',
			'types',
			local.match(relative_path_regex)?.[0] ?? '',
			'$types.d.ts'
		)

		// We will only visite valid routes for Svelte.
		if (!fs.existsSync(svelteTypeFilePath)) {
			return
		}

		// only runs once per directory
		await visitor.route(
			{
				dirpath,
				svelteTypeFilePath,
				layoutQueries,
				pageQueries,
				componentQueries,
				layoutExports,
				pageExports,
			},
			dirpath
		)
	}
}

export type RouteVisitor = {
	inlinePageQueries?: RouteVisitorHandler<graphql.OperationDefinitionNode>
	inlineLayoutQueries?: RouteVisitorHandler<graphql.OperationDefinitionNode>
	routePageQuery?: RouteVisitorHandler<graphql.OperationDefinitionNode>
	routeLayoutQuery?: RouteVisitorHandler<graphql.OperationDefinitionNode>
	routeComponentQuery?: RouteVisitorHandler<graphql.OperationDefinitionNode>
	layoutQueries?: RouteVisitorHandler<graphql.OperationDefinitionNode[]>
	pageQueries?: RouteVisitorHandler<graphql.OperationDefinitionNode[]>
	layoutExports?: RouteVisitorHandler<string[]>
	pageExports?: RouteVisitorHandler<string[]>
	route?: RouteVisitorHandler<{
		dirpath: string
		svelteTypeFilePath: string
		layoutQueries: graphql.OperationDefinitionNode[]
		pageQueries: graphql.OperationDefinitionNode[]
		componentQueries: {
			query: graphql.OperationDefinitionNode
			componentPath: string
		}[]
		layoutExports: string[]
		pageExports: string[]
	}>
}

type RouteVisitorHandler<_Payload> = (value: _Payload, filepath: string) => Promise<void> | void

const routeQueryError = (filepath: string) => ({
	filepath,
	message: 'route query error',
})

export function route_page_path(config: Config, filename: string) {
	return resolve_relative(config, filename).replace('.js', '.svelte').replace('.ts', '.svelte')
}

export function store_import({
	page,
	artifact,
	local,
}: {
	page: SvelteTransformPage
	artifact: { name: string }
	local?: string
}): { id: Identifier; added: number } {
	const { ids, added } = ensure_imports({
		config: page.config,
		script: page.script,
		sourceModule: store_import_path({ config: page.config, name: artifact.name }),
		import: [
			store_name({
				config: page.config,
				name: artifact.name,
			}),
		],
	})

	return { id: ids[0], added }
}

export type Framework = 'kit' | 'svelte'
