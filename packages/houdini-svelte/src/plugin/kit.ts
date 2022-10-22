import * as graphql from 'graphql'
import { fs, find_graphql, Config, path } from 'houdini'
import { ensure_imports } from 'houdini/vite'
import recast from 'recast'

import { HoudiniVitePluginConfig } from '.'
import { parseSvelte } from './extract'
import { SvelteTransformPage } from './transforms/types'

type Identifier = recast.types.namedTypes.Identifier

// compute if a path points to a component query or not
export function is_route(config: Config, framework: Framework, filepath: string): boolean {
	// a vanilla svelte app is never considered in a route
	if (framework === 'svelte') {
		return false
	}

	// only consider filepaths in src/routes
	if (!filepath.startsWith(config.routesDir)) {
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

export function is_layout_component(config: Config, filename: string) {
	return (
		resolve_relative(config, filename).replace(config.projectRoot, '').replace('.ts', '.js') ===
		path.sep + path.join('src', 'routes', '+layout.svelte')
	)
}

export function is_layout_something(config: Config, filename: string) {
	return (
		is_layout_script('kit', filename) ||
		is_root_layout(config, filename) ||
		is_root_layout_server(config, filename) ||
		is_root_layout_script(config, filename) ||
		is_layout_component(config, filename)
	)
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
	// if we run into any child with a query, we have a route
	let isRoute = false

	// we need to collect the important values from each special child
	// for the visitor.route handler
	let pageScript: string | null = null
	let layoutScript: string | null = null
	let routePageQuery: graphql.OperationDefinitionNode | null = null
	let routeLayoutQuery: graphql.OperationDefinitionNode | null = null
	const inlineLayoutQueries: graphql.OperationDefinitionNode[] = []
	const inlineQueries: graphql.OperationDefinitionNode[] = []

	// process the children
	for (const child of await fs.readdir(dirpath)) {
		const childPath = path.join(dirpath, child)
		// if we run into another directory, keep walking down
		if ((await fs.stat(childPath)).isDirectory()) {
			await walk_routes(config, framework, visitor, childPath)
		}

		// page scripts
		else if (is_page_script(framework, child)) {
			isRoute = true
			pageScript = childPath
			if (!visitor.pageScript) {
				continue
			}
			await visitor.pageScript(childPath, childPath)
		}

		// layout scripts
		else if (is_layout_script(framework, child)) {
			isRoute = true
			layoutScript = childPath
			if (!visitor.layoutScript) {
				continue
			}
			await visitor.layoutScript(childPath, childPath)
		}

		// page queries
		else if (child === plugin_config(config).pageQueryFilename) {
			isRoute = true

			// load the contents
			const contents = await fs.readFile(childPath)
			if (!contents) {
				continue
			}

			// invoke the visitor
			try {
				routePageQuery = config.extractQueryDefinition(graphql.parse(contents))
			} catch (e) {
				throw routeQueryError(childPath)
			}

			if (!visitor.routePageQuery || !routePageQuery) {
				continue
			}
			await visitor.routePageQuery(routePageQuery, childPath)
		}

		// layout queries
		else if (child === plugin_config(config).layoutQueryFilename) {
			isRoute = true

			// load the contents
			const contents = await fs.readFile(childPath)
			if (!contents) {
				continue
			}

			// invoke the visitor
			try {
				routeLayoutQuery = config.extractQueryDefinition(graphql.parse(contents))
			} catch (e) {
				throw routeQueryError(childPath)
			}

			if (!visitor.routeLayoutQuery || !routeLayoutQuery) {
				continue
			}
			await visitor.routeLayoutQuery(routeLayoutQuery, childPath)
		}

		// inline layout queries
		else if (is_layout_component(config, child)) {
			// load the contents and parse it
			const contents = await fs.readFile(childPath)
			if (!contents) {
				continue
			}
			const parsed = await parseSvelte(contents)
			if (!parsed) {
				continue
			}

			// look for any graphql tags and invoke the walker's handler
			await find_graphql(config, parsed.script, {
				where: (tag) => {
					try {
						return !!config.extractQueryDefinition(tag)
					} catch {
						return false
					}
				},
				tag: async ({ parsedDocument }) => {
					isRoute = true

					let definition = config.extractQueryDefinition(parsedDocument)
					await visitor.inlineLayoutQueries?.(definition, childPath)
					inlineLayoutQueries.push(definition)
				},
			})
		}

		// inline queries
		else if (is_component(config, framework, child)) {
			// load the contents and parse it
			const contents = await fs.readFile(childPath)
			if (!contents) {
				continue
			}
			const parsed = await parseSvelte(contents)
			if (!parsed) {
				continue
			}

			// look for any graphql tags and invoke the walker's handler
			await find_graphql(config, parsed.script, {
				where: (tag) => {
					try {
						return !!config.extractQueryDefinition(tag)
					} catch {
						return false
					}
				},
				tag: async ({ parsedDocument }) => {
					isRoute = true

					let definition = config.extractQueryDefinition(parsedDocument)
					await visitor.inlineQueries?.(definition, childPath)
					inlineQueries.push(definition)
				},
			})
		}
	}

	// if config path is a route, invoke the handler
	if (visitor.route && isRoute) {
		await visitor.route(
			{
				dirpath,
				pageScript,
				layoutScript,
				routePageQuery,
				routeLayoutQuery,
				inlineLayoutQueries,
				inlineQueries,
			},
			dirpath
		)
	}
}

export type RouteVisitor = {
	pageScript?: RouteVisitorHandler<string>
	layoutScript?: RouteVisitorHandler<string>
	routePageQuery?: RouteVisitorHandler<graphql.OperationDefinitionNode>
	routeLayoutQuery?: RouteVisitorHandler<graphql.OperationDefinitionNode>
	inlineLayoutQueries?: RouteVisitorHandler<graphql.OperationDefinitionNode>
	inlineQueries?: RouteVisitorHandler<graphql.OperationDefinitionNode>
	route?: RouteVisitorHandler<{
		dirpath: string
		pageScript: string | null
		layoutScript: string | null
		routePageQuery: graphql.OperationDefinitionNode | null
		routeLayoutQuery: graphql.OperationDefinitionNode | null
		inlineLayoutQueries: graphql.OperationDefinitionNode[]
		inlineQueries: graphql.OperationDefinitionNode[]
	}>
}

type RouteVisitorHandler<_Payload> = (value: _Payload, filepath: string) => Promise<void> | void

export type HoudiniRouteScript = {
	houdini_load?: graphql.OperationDefinitionNode[]
	exports: string[]
}

const routeQueryError = (filepath: string) => ({
	filepath,
	message: 'route query error',
})

export function route_page_path(config: Config, filename: string) {
	return resolve_relative(config, filename).replace('.js', '.svelte').replace('.ts', '.svelte')
}

export function stores_directory_name() {
	return 'stores'
}

// the directory where we put all of the stores
export function stores_directory(plugin_root: string) {
	return path.join(plugin_root, stores_directory_name())
}

export function type_route_dir(config: Config) {
	return path.join(config.typeRootDir, 'src', 'routes')
}

// the path that the runtime can use to import a store
export function store_import_path({ config, name }: { config: Config; name: string }): string {
	return `$houdini/plugins/houdini-svelte/${stores_directory_name()}/${name}`
}

export function store_suffix(config: Config) {
	// if config changes, we might have more forbiddenNames to add in the validator
	return 'Store'
}

export function store_name({ config, name }: { config: Config; name: string }) {
	return name + store_suffix(config)
}

export function global_store_name({ config, name }: { config: Config; name: string }) {
	return plugin_config(config).globalStorePrefix + name
}

export function plugin_config(config: Config): Required<HoudiniVitePluginConfig> {
	const cfg = config.pluginConfig<HoudiniVitePluginConfig>('houdini-svelte')

	return {
		globalStorePrefix: 'GQL_',
		pageQueryFilename: '+page.gql',
		layoutQueryFilename: '+layout.gql',
		quietQueryErrors: false,
		static: false,
		...cfg,
	}
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
		import: `GQL_${artifact.name}`,
	})

	return { id: ids, added }
}

export type Framework = 'kit' | 'svelte'
