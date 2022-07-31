import minimatch from 'minimatch'
import path from 'path'
import { Plugin } from 'vite'
import * as recast from 'recast'
import { Program } from 'estree'
import * as graphql from 'graphql'
import { HoudiniPluginConfig } from '.'
import { Config, getConfig } from '../common'
import { walk_graphql_tags } from './walk'
import { store_import } from './imports'

const AST = recast.types.builders

export default function HoudiniPlugin(plugin_cfg: HoudiniPluginConfig = {}): Plugin {
	return {
		name: 'houdini',

		// add watch-and-run to their vite config
		async config(viteConfig, { command }) {
			return {
				server: {
					...viteConfig.server,
					fs: {
						...viteConfig.server?.fs,
						allow: ['.'].concat(viteConfig.server?.fs?.allow || []),
					},
				},
			}
		},

		// we need to process the source files
		async transform(code, filepath) {
			const houdini_config = await getConfig({ configFile: plugin_cfg?.configPath })
			// the vite plugin is designed to work with sveltekit
			if (houdini_config.framework !== 'kit') {
				return
			}

			// if the file is not in our configured source path, we need to ignore it
			if (!minimatch(filepath, path.join(process.cwd(), houdini_config.sourceGlob))) {
				return
			}

			// build up the return value
			let ast = this.parse(code)
			const result: ReturnType<Required<Plugin>['transform']> = {
				meta: {},
				ast,
			}

			// turn any graphql tags into stores
			const { queries: inline, dependencies } = await transform_gql_tag(
				plugin_cfg,
				houdini_config,
				filepath,
				(result.ast! as unknown) as Program
			)

			// make sure we actually watch the dependencies
			for (const dep of dependencies) {
				this.addWatchFile(dep)
			}

			// if we are looking at a route file, we need to mark its data meta data as a route
			if (houdini_config.isRoute(filepath)) {
				result.meta!.route = {
					// leave the name of every inline query that we processed and wether
					// there should be a variable function defined
					inline,
				}
			}

			// if we are processing a route config file
			if (houdini_config.isRouteConfigFile(filepath)) {
				// in order to know what we need to do here, we need to know if our
				// corresponding page component defined any inline queries
				const pagePath = houdini_config.routePagePath(filepath)
				this.load({ id: pagePath })
				const inline_queries = this.getModuleInfo(pagePath)?.meta.inline || []

				// add a load function for every inline query found in the route
				add_load(plugin_cfg, (result.ast! as unknown) as Program, inline_queries)
			}

			return {
				...result,
				code: recast.print(result.ast!).code,
			}
		},
	}
}

type DiscoveredGraphQLTag = {
	name: string
	variables: boolean
}

async function transform_gql_tag(
	config: HoudiniPluginConfig,
	houdini_config: Config,
	filepath: string,
	code: Program
): Promise<{ queries: DiscoveredGraphQLTag[]; dependencies: string[] }> {
	// the list of queries that we found which require generated loads
	const inline_queries: DiscoveredGraphQLTag[] = []

	// look for
	const dependencies = await walk_graphql_tags(houdini_config, code!, {
		tag(tag) {
			// pull out what we need
			const { node, parsedDocument, parent } = tag
			const operation = parsedDocument.definitions[0] as graphql.ExecutableDefinitionNode

			// if the graphql tag was inside of a call expression, we need to assume that it's a
			// part of an inline document. if the operation is a query, we need to add it to the list
			// so that the load function can have the correct contents
			if (
				operation.kind === 'OperationDefinition' &&
				operation.operation === 'query' &&
				parent.type === 'CallExpression'
			) {
				inline_queries.push({
					name: operation.name!.value,
					variables: Boolean(
						operation.variableDefinitions && operation.variableDefinitions?.length > 0
					),
				})
			}

			// we're going to turn the graphql tag into a reference to the document's
			// store
			node.replaceWith(
				AST.identifier(
					store_import({
						config: houdini_config,
						program: code,
						artifact: { name: operation.name!.value },
					})
				)
			)
		},
	})

	return { queries: inline_queries, dependencies }
}

function add_load(config: HoudiniPluginConfig, code: Program, found: DiscoveredGraphQLTag[]) {
	console.log('adding loading to', code.body[0].type)
}
