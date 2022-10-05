import graphql from 'graphql'
import { Config, fs, find_graphql } from 'houdini'
import { ensure_imports } from 'houdini/vite'
import path from 'path'
import recast from 'recast'

import { parseSvelte } from '../plugin/extract'
import { SvelteTransformPage } from './transforms/types'

type Identifier = recast.types.namedTypes.Identifier

// compute if a path points to a component query or not
export function is_route(config: Config, filepath: string): boolean {
	// a vanilla svelte app is never considered in a route
	if (config.framework === 'svelte') {
		return false
	}

	// only consider filepaths in src/routes
	if (!posixify(filepath).startsWith(posixify(config.routesDir))) {
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

export function is_route_script(config: Config, filename: string) {
	return (
		config.framework === 'kit' &&
		(filename.endsWith('+page.js') ||
			filename.endsWith('+page.ts') ||
			filename.endsWith('+layout.js') ||
			filename.endsWith('+layout.ts'))
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

export function is_component(config: Config, filename: string) {
	return (
		config.framework === 'svelte' ||
		(filename.endsWith('.svelte') &&
			!is_route_script(config, filename) &&
			!is_route(config, filename))
	)
}

export function page_query_path(config: Config, filename: string) {
	return path.join(path.dirname(resolve_relative(config, filename)), config.pageQueryFilename)
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
	visitor: RouteVisitor,
	dirpath = config.routesDir
) {
	// if we run into any child with a query, we have a route
	let isRoute = false

	// we need to collect the important values from each special child
	// for the visitor.route handler
	let routeQuery: graphql.OperationDefinitionNode | null = null
	const inlineQueries: graphql.OperationDefinitionNode[] = []
	let routeScript: string | null = null

	// process the children
	for (const child of await fs.readdir(dirpath)) {
		const childPath = path.join(dirpath, child)
		// if we run into another directory, keep walking down
		if ((await fs.stat(childPath)).isDirectory()) {
			await walk_routes(config, visitor, childPath)
		}

		// route scripts
		else if (is_route_script(config, child)) {
			isRoute = true
			routeScript = childPath
			if (!visitor.routeScript) {
				continue
			}
			await visitor.routeScript(childPath, childPath)
		}

		// route queries
		else if (child === config.pageQueryFilename) {
			isRoute = true

			// load the contents
			const contents = await fs.readFile(childPath)
			if (!contents) {
				continue
			}

			// invoke the visitor
			try {
				routeQuery = config.extractQueryDefinition(graphql.parse(contents))
			} catch (e) {
				throw routeQueryError(childPath)
			}

			if (!visitor.routeQuery || !routeQuery) {
				continue
			}
			await visitor.routeQuery(routeQuery, childPath)
		}

		// inline queries
		else if (is_component(config, child)) {
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
					await visitor.inlineQuery?.(definition, childPath)
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
				routeQuery,
				inlineQueries,
				routeScript,
			},
			dirpath
		)
	}
}

export type RouteVisitor = {
	routeQuery?: RouteVisitorHandler<graphql.OperationDefinitionNode>
	inlineQuery?: RouteVisitorHandler<graphql.OperationDefinitionNode>
	routeScript?: RouteVisitorHandler<string>
	route?: RouteVisitorHandler<{
		dirpath: string
		routeScript: string | null
		routeQuery: graphql.OperationDefinitionNode | null
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

const posixify = (str: string) => str.replace(/\\/g, '/')

export function route_page_path(config: Config, filename: string) {
	return resolve_relative(config, filename).replace('.js', '.svelte').replace('.ts', '.svelte')
}

export function stores_directory_name() {
	return 'stores'
}

// the directory where we put all of the stores
export function stores_directory(root_dir: string) {
	return path.join(root_dir, stores_directory_name())
}

export function type_route_dir(config: Config) {
	return path.join(config.typeRootDir, 'src', 'routes')
}

// the path that the runtime can use to import a store
export function store_import_path({ config, name }: { config: Config; name: string }): string {
	return `$houdini/${stores_directory_name()}/${name}`
}

export function store_suffix(config: Config) {
	// if config changes, we might have more forbiddenNames to add in the validator
	return 'Store'
}

export function store_name({ config, name }: { config: Config; name: string }) {
	return name + store_suffix(config)
}

export function global_store_name({ config, name }: { config: Config; name: string }) {
	return config.globalStorePrefix + name
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
