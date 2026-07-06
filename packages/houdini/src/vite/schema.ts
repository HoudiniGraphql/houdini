import path from 'node:path'
import type { GraphQLSchema } from 'graphql'
import * as graphql from 'graphql'
import type { ModuleNode, PluginOption } from 'vite'
import { fs, get_config, run_pipeline } from '../lib/index.js'
import { pull_schema } from '../lib/schema.js'
import { sleep } from '../lib/sleep.js'
import { compiler } from './hmr.js'
import type { VitePluginContext } from './index.js'

/*
 * The schema watching support is made up of 3 parts:
 * 1. A plugin that polls the remote schema on an interval and writes the value to disk
 * 2. a plugin that watches the local schema for changes, and writes the serialized value to dist
 * 3. a plugin that watches the serialized schema file and triggers a codegen run when it changes
 */

// Tracks schema file paths written by write_local_schema so refresh_on_schema
// can skip them — otherwise the startup write triggers a second pipeline run.
const ownSchemaWrites = new Set<string>()

export function refresh_on_schema(_ctx: VitePluginContext): PluginOption {
	return {
		name: 'houdini-refresh-on-schema',

		async handleHotUpdate({ file, server }) {
			const config = await get_config()

			// this plugin only cares when the serialized schema changes
			if (file !== path.join(server.config.root, config.schema_path())) {
				return
			}

			// Skip writes we made ourselves (e.g. the startup write from write_local_schema)
			// so we don't trigger a second pipeline run immediately after startup.
			if (ownSchemaWrites.has(file)) {
				ownSchemaWrites.delete(file)
				return
			}

			// if the compiler hasn't started yet then there's nothing to do
			if (!compiler) {
				return
			}

			// trigger_hook handles flush before Go runs and reload after.
			// The Schema hook itself clears stale type_fields before re-inserting.
			try {
				await compiler.pipeline_lock(() =>
					run_pipeline(compiler.trigger_hook, { start: 'Schema' })
				)
			} catch (e) {
				console.error(e)
			}
			// ctx.db is reloaded by the last trigger_hook inside run_pipeline
		},
	}
}

export function poll_remote_schema(_ctx: VitePluginContext): PluginOption {
	// we want to stop polling when the plugin closes
	let go = true

	return {
		name: 'houdini-poll-remote-schema',

		// Cleanup when the plugin is closed
		buildEnd() {
			go = false
		},

		// Also cleanup when dev server is configured (for dev mode)
		configureServer(server) {
			server.httpServer?.once('close', () => {
				go = false
			})
		},

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

			// grab the polling interval (|| undefined coerces a `false`/`null` watchSchema away)
			const interval = (config.config_file.watchSchema || undefined)?.interval
			// null interval (or a disabled watchSchema) means no polling
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
						(config.config_file.watchSchema || undefined)?.timeout ?? 30000,
						config.schema_path(),
						await config.schema_pull_headers(),
						!((config.config_file.watchSchema || undefined)?.writePolledSchema ?? true)
					)
					error_count = 0
				} catch (_e) {
					error_count += 1
				}
				// if we're suposed to poll more than once then keep going
				if (more) {
					const wait_time = Math.min(interval! + interval! * error_count, max_interval)
					await sleep(wait_time)

					// Only continue polling if the plugin is still active
					if (go) {
						await pull(more)
					}
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
export function watch_local_schema(_ctx: VitePluginContext): PluginOption {
	return {
		name: 'houdini-watch-local-schema',

		// Write the serialized schema at startup so houdini-core's Schema hook sees
		// the current schema even before any file changes trigger handleHotUpdate.
		async configureServer(server) {
			const config = await get_config()
			await write_local_schema(server, config.root_dir, config.schema_path())
		},

		// hotUpdate (not the legacy handleHotUpdate) so create events are handled too.
		async hotUpdate(opts) {
			if (opts.type === 'delete') return

			const config = await get_config()
			const local_schema_path = await resolve_local_schema(
				path.join(config.root_dir, 'src', 'server', '+schema')
			)
			if (!local_schema_path) return

			const schema_mod_path = `${local_schema_path}?t=${Date.now()}`
			let schema: GraphQLSchema
			try {
				schema = (await opts.server.ssrLoadModule(schema_mod_path)).default
			} catch {
				return
			}

			const schema_mod = await opts.server.moduleGraph.getModuleByUrl(schema_mod_path)

			// If getModuleByUrl can't find the module (URL normalization edge case), fall
			// back to checking whether the changed file IS the schema file rather than
			// silently skipping.
			const relevant = schema_mod
				? depends_on(schema_mod, opts.file)
				: opts.file === local_schema_path
			if (!relevant) return

			const write_target = path.join(opts.server.config.root, config.schema_path())
			// Mark the write so refresh_on_schema's file-watcher path doesn't double-trigger.
			ownSchemaWrites.add(write_target)
			await serialize_and_write(schema, write_target)
			setTimeout(() => ownSchemaWrites.delete(write_target), 2000)

			// Trigger the pipeline directly — no need to bounce through the file watcher.
			// The Schema hook itself clears stale type_fields before re-inserting.
			if (!compiler) return
			try {
				await compiler.pipeline_lock(() =>
					run_pipeline(compiler.trigger_hook, { start: 'Schema' })
				)
			} catch (e) {
				console.error(e)
			}
		},
	} as PluginOption
}

// Resolve '+schema' to its actual file on disk, trying common JS/TS extensions.
async function resolve_local_schema(base: string): Promise<string | null> {
	for (const ext of ['', '.ts', '.js', '.tsx', '.jsx']) {
		try {
			await fs.access(base + ext)
			return base + ext
		} catch {}
	}
	return null
}

async function write_local_schema(
	server: { ssrLoadModule: (path: string) => Promise<any>; config: { root: string } },
	root_dir: string,
	schema_path: string
) {
	const local_schema_path = await resolve_local_schema(
		path.join(root_dir, 'src', 'server', '+schema')
	)
	if (!local_schema_path) return

	let schema: GraphQLSchema
	try {
		schema = (await server.ssrLoadModule(local_schema_path + '?t=' + Date.now())).default
	} catch {
		return
	}

	const write_target = path.join(server.config.root, schema_path)
	// Mark the write so refresh_on_schema doesn't trigger a second pipeline run.
	ownSchemaWrites.add(write_target)
	await serialize_and_write(schema, write_target)
	// Fallback cleanup in case the watcher never fires (e.g. schema unchanged).
	setTimeout(() => ownSchemaWrites.delete(write_target), 2000)
}

async function serialize_and_write(schema: GraphQLSchema, write_target: string) {
	let fileData = ''
	if (
		write_target.endsWith('gql') ||
		write_target.endsWith('graphql') ||
		write_target.endsWith('graphqls')
	) {
		fileData = graphql.printSchema(graphql.lexicographicSortSchema(schema))
	} else {
		fileData = JSON.stringify(graphql.introspectionFromSchema(schema))
	}
	await fs.writeFile(write_target, fileData)
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
