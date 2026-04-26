import { type ChildProcess, spawn } from 'node:child_process'
import path from 'node:path'
import sqlite, { type DatabaseSync } from 'node:sqlite'
import { WebSocket } from 'ws'

import * as conventions from '../router/conventions.js'
import type { Config } from './config.js'
import { create_schema, write_config } from './database.js'
import type { HookError } from './error.js'
import { format_hook_error } from './error.js'
import * as fs from './fs.js'
import type { ProjectManifest } from './types'

export type PluginSpec = {
	name: string
	port: number
	directory: string
	hooks: Set<string>
	order: 'before' | 'after' | 'core'
}

export type Adapter = ((args: {
	config: Config
	conventions: typeof conventions
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
		conventions: typeof conventions
		sourceDir: string
		publicBase: string
		outDir: string
	}) => Promise<void> | void
}

export function connect_db(config: Config): [DatabaseSync, string] {
	const filepath = conventions.db_path(config)
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

export async function init_db(config: Config, preserve: boolean): Promise<[DatabaseSync, string]> {
	const db_file = conventions.db_path(config)

	// we need to create a fresh database for orchestration
	if (!preserve) {
		try {
			await fs.remove(db_file)
		} catch (e) {}
		try {
			await fs.remove(`${db_file}-shm`)
		} catch (e) {}
		try {
			await fs.remove(`${db_file}-wal`)
		} catch (e) {}
	}
	return [connect_db(config)[0], db_file]
}

export type CompilerProxy = {
	close: () => Promise<void>
	trigger_hook: (
		name: PipelineHook,
		opts?: { parallel_safe?: boolean; payload?: {}; task_id?: string }
	) => Promise<Record<string, any> | null>
	database_path: string
	run_pipeline: (
		options: RunPipelineOptions
	) => Promise<Record<PipelineHook, Record<string, any>>>
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
	await fs.mkdirpSync(conventions.houdini_root(config))

	const plugins: Record<string, PluginSpec & { process: ChildProcess }> = {}

	// when plugins announce themselves, they provide a port
	const plugin_specs: Array<PluginSpec> = []
	const spec_results: Record<string, PluginSpec> = {}

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
							config_module: string | null
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
						directory: config.plugins.find((p) => p.name === name)?.directory || '',
					}

					// store the spec
					spec_results[name] = spec

					// if the row specifies a config module then we need to import it and invoke it
					if (row.config_module) {
						import(row.config_module).then((module) => {
							if (module && typeof module.default === 'function') {
								config.config_file = module.default(config.config_file)
							}
							resolver(spec)
						})
					} else {
						resolver(spec)
					}

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

	for (const plugin of config.plugins) {
		plugin_specs.push(spec_results[plugin.name])
	}

	console.timeEnd('Start Plugins')

	const wsConnections = new Map<string, WebSocket>()
	let messageCounter = 0
	const pendingRequests = new Map<
		string,
		{
			resolve: (value: any) => void
			reject: (reason: any) => void
			timeout: NodeJS.Timeout
			hook: string
		}
	>()

	async function getOrCreateWS(name: string, port: number): Promise<WebSocket> {
		const existing = wsConnections.get(name)
		if (existing && existing.readyState === WebSocket.OPEN) {
			return existing
		}

		return new Promise((resolve, reject) => {
			// get a new connection
			const wsUrl = `ws://localhost:${port}/ws`
			const ws = new WebSocket(wsUrl)

			ws.on('open', () => {
				// clear any pending requests
				wsConnections.set(name, ws)
				return resolve(ws)
			})

			// Set up message handler for this connection
			ws.on('message', (data: Buffer) => {
				try {
					const response = JSON.parse(data.toString())
					const pending = pendingRequests.get(response.id)
					if (!pending) return

					clearTimeout(pending.timeout)
					pendingRequests.delete(response.id)

					switch (response.type) {
						case 'error':
							// Non-fatal error - log and continue listening
							console.error(`!   [${name}] ${response.error}`)
							pending.reject(new Error(`${name}: ${response.error}`))
							break

						case 'response':
							if (response.error) {
								// Handle errors like the old HTTP implementation
								const errors: HookError[] = Array.isArray(response.error)
									? response.error
									: [response.error]

								errors.forEach((error) => {
									format_hook_error(config.root_dir, error, name, pending.hook)
								})

								pending.reject(new Error(`Failed to call ${name}`))
							} else {
								pending.resolve(response.result)
							}
							break

						default:
							console.warn(`[${name}] Unknown message type: ${response.type}`)
							pending.reject(new Error(`Unknown message type: ${response.type}`))
					}
				} catch (err) {
					// if parsing the message fails, then we are not sure which pending request it belongs to
					// just log and move on
					console.error(`Error processing WebSocket message for ${name}:`, err)
				}
			})

			ws.on('error', (err: Error) => {
				console.error(`WebSocket error for ${name}:`, err)
				wsConnections.delete(name)
				reject(new Error(`WebSocket error for ${name}: ${err}`))
			})

			ws.on('close', () => {
				// Remove from pool so next request creates new connection
				// requests will eventually timeout and be rejected, we can agressively remove them but it's not a big deal
				wsConnections.delete(name)
			})
		})
	}

	const invoke_hook = async (
		name: string,
		hook: string,
		payload: Record<string, any> = {},
		task_id?: string
	): Promise<any> => {
		const plugin = plugin_specs.find((spec) => spec.name === name)
		if (!plugin) {
			throw new Error(`unknown plugin: ${name}`)
		}
		const { port, directory } = plugin
		const ws = await getOrCreateWS(name, port)

		return new Promise((resolve, reject) => {
			const messageId = String(++messageCounter)

			const timeout = setTimeout(() => {
				pendingRequests.delete(messageId)
				reject(new Error(`WebSocket request timeout for ${name}/${hook}`))
			}, 30000)
			pendingRequests.set(messageId, { resolve, reject, timeout, hook })

			const message = {
				id: messageId,
				type: 'request',
				hook,
				payload,
				taskId: task_id,
				pluginDirectory: directory,
			}
			ws.send(JSON.stringify(message))
		})
	}

	const trigger_hook = async (
		hook: PipelineHook,
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
		const plugins = plugin_specs.filter(({ hooks }) => hooks.has(hook))

		const result: Record<string, any> = {}

		// if the hook is parallel safe, we can run all of the plugins in parallel
		if (parallel_safe) {
			await Promise.all(
				plugins.map(async (plugin) => {
					result[plugin.name] = await invoke_hook(plugin.name, hook, payload, task_id)
				})
			)
		} else {
			// if the hook isn't parallel safe, we need to run the plugins in order
			for (const { name } of plugins) {
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
		run_pipeline: (options: RunPipelineOptions) => run_pipeline(trigger_hook, options),
		close: async () => {
			// close ws connections first, this will trigger plugin processes to exit gracefully
			for (const [name, ws] of wsConnections.entries()) {
				try {
					if (ws.readyState === WebSocket.OPEN) {
						// 1001 (Going Away) signals to plugins they should exit
						ws.close(1001, 'shutdown')
					}
				} catch (err) {
					console.error(`Error closing WebSocket for ${name}:`, err)
				}
			}
			wsConnections.clear()

			// clear pending requests
			for (const [, { timeout }] of pendingRequests.entries()) {
				clearTimeout(timeout)
			}
			pendingRequests.clear()

			// give plugins a moment to exit gracefully
			await new Promise((resolve) => setTimeout(resolve, 100))

			// Close our connection to the database
			try {
				db.close()
			} catch {}

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
								// Check if process still exists (signal 0 doesn't kill, just checks)
								process.kill(plugin.process.pid, 0)
								// Process exists, kill the process group
								process.kill(-plugin.process.pid, 'SIGINT')
							} catch {
								// Process already exited from WebSocket close - nothing to do
							}
						}
					}
				})
			)
		},
	}
}

// Define the complete pipeline order
export const PIPELINE_HOOKS = [
	'Config',
	'AfterLoad',
	'Schema',
	'ExtractDocuments',
	'AfterExtract',
	'BeforeValidate',
	'Validate',
	'AfterValidate',
	'BeforeGenerate',
	'GenerateDocuments',
	'GenerateRuntime',
	'AfterGenerate',
] as const

export type PipelineHook = (typeof PIPELINE_HOOKS)[number]

export type RunPipelineOptions = {
	task_id?: string
	after?: PipelineHook
	start?: PipelineHook
	through?: PipelineHook
}

export async function run_pipeline(
	trigger_hook: CompilerProxy['trigger_hook'],
	options: RunPipelineOptions = {}
): Promise<Record<PipelineHook, Record<string, any>>> {
	const { task_id, after, start, through } = options
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
	if (start) {
		const index = PIPELINE_HOOKS.indexOf(start)
		if (index === -1) {
			throw new Error(`Unknown hook: ${after}`)
		}
		startIndex = index
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
		// GenerateRuntime is NOT parallel_safe because houdini-svelte's
		// UpdateIndexFiles needs to read index.ts that houdini-core creates
		if (hook === 'Validate' || hook === 'GenerateDocuments') {
			opts.parallel_safe = true
		}

		// GenerateDocuments and GenerateRuntime have no data dependency on each other —
		// both read from the DB which is fully settled after AfterValidate. Run them
		// concurrently when they appear consecutively in the active range.
		if (
			hook === 'GenerateDocuments' &&
			i + 1 <= endIndex &&
			PIPELINE_HOOKS[i + 1] === 'GenerateRuntime'
		) {
			const [gdResult, grResult] = await Promise.all([
				trigger_hook('GenerateDocuments', { task_id, parallel_safe: true }),
				trigger_hook('GenerateRuntime', { task_id }),
			])
			results['GenerateDocuments'] = gdResult
			results['GenerateRuntime'] = grResult
			i++ // GenerateRuntime already handled
			continue
		}

		results[hook] = await trigger_hook(hook, opts)
	}

	return results
}
