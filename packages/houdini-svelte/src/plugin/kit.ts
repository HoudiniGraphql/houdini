import * as graphql from 'graphql'
import { fs, find_graphql, Config, path } from 'houdini'
import { ensure_imports } from 'houdini/vite'
import recast from 'recast'

import { HoudiniVitePluginConfig } from '.'
import { parseSvelte } from './extract'
import { extract_load_function } from './extractLoadFunction'
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

export function is_layout_component(framework: Framework, filename: string) {
	return framework === 'kit' && filename.endsWith('+layout.svelte')
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
			const parsed = await parseSvelte(contents)
			if (!parsed) {
				continue
			}

			await find_graphql(config, parsed.script, {
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
		} else if (is_component(config, framework, child)) {
			validRoute = true
			const contents = await fs.readFile(childPath)
			if (!contents) {
				continue
			}
			const parsed = await parseSvelte(contents)
			if (!parsed) {
				continue
			}

			// look for any graphql tags and push into queries.
			await find_graphql(config, parsed.script, {
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
		const svelteTypeFilePath = path.join(
			config.projectRoot,
			'.svelte-kit',
			'types',
			dirpath.match(relative_path_regex)?.[0] ?? '',
			'$types.d.ts'
		)

		// if type does not exists we error.
		if (!fs.existsSync(svelteTypeFilePath)) {
			throw Error(`SvelteKit types do not exist at route: ${svelteTypeFilePath}`)
		}

		// only runs once per directory
		await visitor.route(
			{
				dirpath,
				svelteTypeFilePath,
				layoutQueries,
				pageQueries,
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
	layoutQueries?: RouteVisitorHandler<graphql.OperationDefinitionNode[]>
	pageQueries?: RouteVisitorHandler<graphql.OperationDefinitionNode[]>
	layoutExports?: RouteVisitorHandler<string[]>
	pageExports?: RouteVisitorHandler<string[]>
	route?: RouteVisitorHandler<{
		dirpath: string
		svelteTypeFilePath: string
		layoutQueries: graphql.OperationDefinitionNode[]
		pageQueries: graphql.OperationDefinitionNode[]
		layoutExports: string[]
		pageExports: string[]
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
		customStores: {
			query: '$houdini/plugins/houdini-svelte/runtime/stores.QueryStore',
			mutation: '$houdini/plugins/houdini-svelte/runtime/stores.MutationStore',
			fragment: '$houdini/plugins/houdini-svelte/runtime/stores.FragmentStore',
			subscription: '$houdini/plugins/houdini-svelte/runtime/stores.SubscriptionStore',
			queryForwardsCursor:
				'$houdini/plugins/houdini-svelte/runtime/stores.QueryStoreForwardCursor',
			queryBackwardsCursor:
				'$houdini/plugins/houdini-svelte/runtime/stores.QueryStoreBackwardCursor',
			queryOffset: '$houdini/plugins/houdini-svelte/runtime/stores.QueryStoreOffset',
			fragmentForwardsCursor:
				'$houdini/plugins/houdini-svelte/runtime/stores.FragmentStoreForwardCursor',
			fragmentBackwardsCursor:
				'$houdini/plugins/houdini-svelte/runtime/stores.FragmentStoreBackwardCursor',
			fragmentOffset: '$houdini/plugins/houdini-svelte/runtime/stores.FragmentStoreOffset',
			...cfg?.customStores,
		},
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
