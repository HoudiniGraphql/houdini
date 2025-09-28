import { type ChildProcess, spawn } from 'node:child_process'
import path from 'node:path'
import sqlite, { type DatabaseSync } from 'node:sqlite'
import { format_hook_error, type HookError } from 'src/lib/error'

import * as fs from '../lib/fs'
import type { ProjectManifest } from '../runtime'
import { db_path, houdini_root } from './conventions'
import type * as routerConventions from './conventions'
import { create_schema, write_config } from './database'
import { type Config } from './project'

export type PluginSpec = {
	name: string
	port: number
	hooks: Set<string>
	order: 'before' | 'after' | 'core'
}

export type Adapter = ((args: {
	config: Config
	conventions: typeof routerConventions
	sourceDir: string
	publicBase: string
	outDir: string
	manifest: ProjectManifest
	adapterPath: string
}) => void | Promise<void>) & {
	includePaths?: Record<string, string> | ((args: { config: Config }) => Record<string, string>)
	disableServer?: boolean
	pre?: (args: {
		config: Config
		conventions: typeof routerConventions
		sourceDir: string
		publicBase: string
		outDir: string
	}) => Promise<void> | void
}

export function connect_db(config: Config): [DatabaseSync, string] {
	const filepath = db_path(config)
	const db = new sqlite.DatabaseSync(filepath)
	db.exec('PRAGMA journal_mode = WAL')
	db.exec('PRAGMA synchronous = off')
	db.exec('PRAGMA cache_size = 10000')
	db.exec('PRAGMA temp_store = memory')
	db.exec('PRAGMA busy_timeout = 5000')
	db.exec('PRAGMA foreign_key = ON')
	db.exec('PRAGMA defer_foreign_keys = ON')

	// TODO: we might have to destroy the existing tables if we run with a new version
	db.exec(create_schema)

	return [db, filepath]
}

export async function init_db(config: Config): Promise<[DatabaseSync, string]> {
	// we need to create a fresh database for orchestration
	const db_file = db_path(config)
	try {
		await fs.remove(db_file)
	} catch (e) {}
	try {
		await fs.remove(`${db_file}-shm`)
	} catch (e) {}
	try {
		await fs.remove(`${db_file}-wal`)
	} catch (e) {}
	return [connect_db(config)[0], db_file]
}

export type CompilerProxy = {
	close: () => Promise<void>
	trigger_hook: (
		name: string,
		opts?: { parallel_safe?: boolean; payload?: {}; task_id?: string }
	) => Promise<Record<string, any> | null>
	database_path: string
}

// codegen_setup sets up the codegen pipe before we start generating files. this primarily means starting
// the config server along with each plugin
export async function codegen_setup(
	config: Config,
	mode: string,
	db: DatabaseSync,
	db_file: string
): Promise<CompilerProxy> {
	// We need the root dir before we get to the exciting stuff
	await fs.mkdirpSync(houdini_root(config))

	const plugins: Record<string, PluginSpec & { process: ChildProcess }> = {}

	// when plugins announce themselves, they provide a port
	const plugin_specs: Record<string, PluginSpec> = {}

	// we need a function that waits for a plugin to register itself
	const wait_for_plugin = (name: string) =>
		new Promise<PluginSpec>((resolve, reject) => {
			const find_plugin = db.prepare('SELECT * FROM plugins WHERE name = ?')

			// waiting for a plugin means polling the database until we see the plugin announce itself
			const interval = setInterval(() => {
				const row = find_plugin.get(name) as
					| {
							name: string
							port: number
							hooks: string
							plugin_order: string
					  }
					| undefined
				if (row) {
					// we found the plugin, stop polling
					clearInterval(interval)

					// update the plugin spec with the user provided config
					db.prepare('UPDATE plugins set config = ? where name = ?').run(
						JSON.stringify(config.plugins.find((p) => p.name === name)?.config ?? {}),
						name
					)

					// create the plugin spec
					const spec: PluginSpec = {
						name: row.name,
						port: row.port,
						hooks: new Set(JSON.parse(row.hooks)),
						order: row.plugin_order as 'before' | 'after' | 'core',
					}

					// store the spec
					plugin_specs[name] = spec

					// resolve the promise
					resolver(spec)
				}
			}, 10)

			// Create a timeout that will reject after 2 seconds
			const timeout = setTimeout(() => {
				clearInterval(interval)
				reject(new Error(`Timeout waiting for plugin ${name} to register`))
			}, 10000)

			// Create a resolver function that clears the timeout
			const resolver = (spec: PluginSpec) => {
				clearTimeout(timeout)
				resolve(spec)
			}
		})

	// delete existing plugin metadata
	db.prepare('DELETE FROM plugins').run()

	// start each plugin
	console.time('Start Plugins')
	await Promise.all(
		config.plugins.map(async (plugin) => {
			let executable = plugin.executable
			const args = ['--database', db_file]

			// Run the plugin through a node shim if it's a javascript plugin
			const jsExtensions = ['.js', '.mjs', '.cjs']
			if (jsExtensions.includes(path.extname(plugin.executable))) {
				executable = 'node'
				args.unshift(plugin.executable)
			}

			console.time(`Spawn ${plugin.name}`)
			plugins[plugin.name] = {
				// kick off the plugin process
				process: spawn(executable, args, {
					stdio: 'inherit',
					detached: process.platform !== 'win32',
				}),

				// and wait for the plugin to report back its port
				...(await wait_for_plugin(plugin.name)),
			}
			console.timeEnd(`Spawn ${plugin.name}`)
		})
	)
	console.timeEnd('Start Plugins')

	const invoke_hook = async (
		name: string,
		hook: string,
		payload: Record<string, any> = {},
		task_id?: string
	) => {
		const { port } = plugin_specs[name]

		// make the request
		const response = await fetch(`http://localhost:${port}/${hook.toLowerCase()}`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'X-Task-ID': task_id?.toString() ?? '',
			},
			body: JSON.stringify(payload),
		})

		// if the request failed, throw an error
		if (!response.ok) {
			if (response.status === 404) {
				throw new Error(`Plugin ${name} does not support hook ${hook}`)
			}
			const responseJSON = await response.json()
			const errors: HookError[] = Array.isArray(responseJSON) ? responseJSON : [responseJSON]
			errors.forEach((error) => {
				format_hook_error(config.root_dir, error, name)
			})
			// errors
			throw new Error(`Failed to call ${name}/${hook.toLowerCase()}`)
		}
		// look at the response headers, and if the content type is application/json, parse the body
		const contentType = response.headers.get('content-type')
		if (contentType && contentType.includes('application/json')) {
			return await response.json()
		}
		return await response.text()
	}

	const trigger_hook = async (
		hook: string,
		{
			parallel_safe,
			payload,
			task_id,
		}: {
			parallel_safe?: boolean
			payload?: Record<string, any>
			task_id?: string
		} = {}
	) => {
		const timeName = hook + (task_id ? ` (${task_id})` : '')
		console.time(timeName)
		// look for all of the plugins that have registered for this hook
		const plugins = Object.entries(plugin_specs).filter(([, { hooks }]) => hooks.has(hook))

		const result: Record<string, any> = {}

		// if the hook is parallel safe, we can run all of the plugins in parallel
		if (parallel_safe) {
			await Promise.all(
				plugins.map(async ([plugin]) => {
					result[plugin] = await invoke_hook(plugin, hook, payload, task_id)
				})
			)
		} else {
			// if the hook isn't parallel safe, we need to run the plugins in order
			for (const [name] of plugins) {
				result[name] = await invoke_hook(name, hook, payload, task_id)
			}
		}
		console.timeEnd(timeName)

		return result
	}

	// write the current config values to the database
	await write_config(db, config, invoke_hook, plugin_specs, mode)

	// now we should load the config hook so other plugins can set their defaults
	await trigger_hook('Config')

	// now that we've loaded the environment, we need to invoke the afterLoad hook
	await trigger_hook('AfterLoad')

	// add any plugin-specifics to our schema
	await trigger_hook('Schema')

	return {
		database_path: db_file,
		trigger_hook,
		close: async () => {
			// Close our connection to the database
			db.close()

			// Stop each plugin with proper cleanup
			await Promise.all(
				Object.entries(plugins).map(async ([, plugin]) => {
					if (plugin.process.pid) {
						if (process.platform === 'win32') {
							// On Windows, use taskkill to ensure the process tree is terminated.
							try {
								spawn('taskkill', [
									'/pid',
									plugin.process.pid.toString(),
									'/f',
									'/t',
								])
							} catch (err) {
								// Ignore errors if the process is already gone
							}
						} else {
							// On Unix-like systems, send SIGINT to the process group
							try {
								// The child was spawned with detached: true so that it is its own process group.
								process.kill(-plugin.process.pid, 'SIGINT')
							} catch (err) {}
						}
					}
				})
			)
		},
	}
}

// Define the complete pipeline order
const PIPELINE_HOOKS = [
	'ExtractDocuments',
	'AfterExtract',
	'BeforeValidate',
	'Validate',
	'AfterValidate',
	'BeforeGenerate',
	'Generate',
] as const

type PipelineHook = (typeof PIPELINE_HOOKS)[number]

export type RunPipelineOptions = {
	task_id?: string
	after?: PipelineHook
	through?: PipelineHook
}

export async function run_pipeline(
	trigger_hook: CompilerProxy['trigger_hook'],
	options: RunPipelineOptions = {}
): Promise<Record<PipelineHook, Record<string, any>>> {
	const { task_id, after, through } = options
	const results: Record<string, any> = {}

	// Find the start and end indices
	let startIndex = 0
	let endIndex = PIPELINE_HOOKS.length - 1

	if (after) {
		const afterIndex = PIPELINE_HOOKS.indexOf(after)
		if (afterIndex === -1) {
			throw new Error(`Unknown hook: ${after}`)
		}
		startIndex = afterIndex + 1
	}

	if (through) {
		endIndex = PIPELINE_HOOKS.indexOf(through)
		if (endIndex === -1) {
			throw new Error(`Unknown hook: ${through}`)
		}
	}

	// Validate that we have a valid range
	if (startIndex > endIndex) {
		return results
	}

	// Execute the hooks in order
	for (let i = startIndex; i <= endIndex; i++) {
		const hook = PIPELINE_HOOKS[i]
		const opts: any = { task_id }

		// Set parallel_safe for hooks that support it
		if (hook === 'Validate' || hook === 'Generate') {
			opts.parallel_safe = true
		}

		results[hook] = await trigger_hook(hook, opts)
	}

	return results
}
