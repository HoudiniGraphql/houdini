import * as graphql from 'graphql'
import type { GraphQLSchema } from 'graphql'
import path from 'node:path'
import type { PluginOption, ModuleNode } from 'vite'

import type { VitePluginContext } from '.'
import { get_config, fs, run_pipeline } from '../lib/index.js'
import { pull_schema } from '../lib/schema.js'
import { sleep } from '../lib/sleep.js'
import { compiler } from './hmr.js'

/*
 * The schema watching support is made up of 3 parts:
 * 1. A plugin that polls the remote schema on an interval and writes the value to disk
 * 2. a plugin that watches the local schema for changes, and writes the serialized value to dist
 * 3. a plugin that watches the serialized schema file and triggers a codegen run when it changes
 */

export function refresh_on_schema(ctx: VitePluginContext): PluginOption {
	return {
		name: 'houdini-refresh-on-schema',

		async handleHotUpdate({ file, server }) {
			const config = await get_config()

			// this plugin only cares when the serialized schema changes
			if (file !== path.join(server.config.root, config.schema_path())) {
				return
			}

			// if the compiler hasn't started yet then there's nothing to do
			if (!compiler) {
				return
			}

			// when there's a schema update, the only thing that could change documents that are already
			// loaded is that they're types could change which will require re-valildation
			// that means that when we detect there is a schema change we have to do 2 things:
			// 1. delete all of the type_field information for non-component fields
			// 2. re-run validation
			// 3. re-run generation since the types may have changed which changes the generated artifact (scalars)
			//
			// since we want to run on all known documents, we don't need to worry about tasks

			// delete the non-component type fields
			ctx.db
				.prepare(
					`
        DELETE FROM type_fields
        WHERE id IN (
          SELECT type_fields.id FROM type_fields 
            LEFT JOIN component_fields ON component_fields.type_field = type_fields.id 
          WHERE component_fields.id IS NULL
        )
      `
				)
				.run()

			try {
				// load the schema
				await run_pipeline(compiler.trigger_hook, { start: 'Schema' })
			} catch (e) {
				console.log(e)
			}
		},
	}
}

export function poll_remote_schema(ctx: VitePluginContext): PluginOption {
	// we want to stop polling when the plugin closes
	let go = true

	return {
		name: 'houdini-poll-remote-schema',
		async buildStart() {
			// load the relevant data from the project config
			const config = await get_config()
			const api_url = await config.api_url()

			// if there is no url set then don't do anything
			if (!api_url) {
				return
			}

			// if the schema path is a glob then it doesn't point to a single file so we should assume its
			// local and not try to fetch it
			if (config.config_file.schemaPath && fs.glob.hasMagic(config.config_file.schemaPath)) {
				return
			}

			// grab the polling interval
			const interval = config.config_file.watchSchema?.interval
			// null interval means no polling
			if (interval == null) {
				return
			}

			// we want to back off on polling the server if we get errors
			let error_count = 0

			// dont poll if the delay is greater than 5 minutes
			const max_interval = 1000 * 60 * 5

			// the function to poll the server
			async function pull(more: boolean) {
				try {
					await pull_schema(
						api_url!,
						config.config_file.watchSchema?.timeout ?? 30000,
						config.schema_path(),
						await config.schema_pull_headers()
					)
					error_count = 0
				} catch (e) {
					error_count += 1
				}
				// if we're suposed to poll more than once then keep going
				if (more) {
					const wait_time = Math.min(interval! + interval! * error_count, max_interval)
					await sleep(wait_time)
				}

				if (go) {
					pull(more)
				}
			}

			// if we got this far, its safe to poll the schema at least once
			await pull(false)

			// if the interval is 0 or less, we don't want to poll again
			if (interval <= 0) {
				return
			}

			// wait one tick before polling again
			await sleep(interval)

			// and then start polling
			await pull(true)
		},
	}
}

// a plugin that re-runs the codegen pipline when the schema changes
export function watch_local_schema(ctx: VitePluginContext): PluginOption {
	return {
		name: 'houdini-refresh-on-schema',

		async handleHotUpdate({ file, server }) {
			// build up the path to the local schema file
			const config = await get_config()
			const local_schema_path = path.join(config.root_dir, 'src', 'api', '+schema')

			// before we go  any further, check if teh file exists
			try {
				await fs.access(local_schema_path)
			} catch {
				return
			}

			// load the current schema into the module graph
			const schema_mod_path = local_schema_path + '?t=' + Date.now()
			let schema: GraphQLSchema
			try {
				schema = (await server.ssrLoadModule(schema_mod_path)).default
			} catch {
				return
			}
			const schema_mod = await server.moduleGraph.getModuleByUrl(schema_mod_path)

			// if the schema module does not dependon the filepath then there is no update so we can ignore it
			if (!(schema_mod && depends_on(schema_mod, file))) {
				return
			}

			// pull the target schema path out of the config
			const write_target = path.join(server.config.root, config.schema_path())

			// figure out what we need to write
			let fileData = ''
			if (
				write_target!.endsWith('gql') ||
				write_target!.endsWith('graphql') ||
				write_target.endsWith('graphqls')
			) {
				fileData = graphql.printSchema(graphql.lexicographicSortSchema(schema))
			} else {
				fileData = JSON.stringify(graphql.introspectionFromSchema(schema))
			}

			// write the file
			await fs.writeFile(write_target, fileData)
		},
	} as PluginOption
}

function depends_on(mod: ModuleNode, filepath: string): boolean {
	// the filepath could be the module itself
	if (filepath === mod.file) {
		return true
	}

	// Queue seeded with direct imports
	const queue: ModuleNode[] = [...mod.importedModules]
	const seen = new Set<ModuleNode>(queue) // mark initial ones as seen

	// pointer-based queue to avoid O(n) shift
	for (let i = 0; i < queue.length; i++) {
		const cur = queue[i]

		// Some nodes might not have .file (virtual modules); fall back to .url/id if needed
		if (cur.file === filepath /* || cur.url === filepath || cur.id === filepath */) {
			return true
		}

		// enqueue children
		for (const next of cur.importedModules) {
			if (!seen.has(next)) {
				seen.add(next)
				queue.push(next)
			}
		}
	}

	// if we got this far then the file is not part of the schema's dependency graph
	return false
}
