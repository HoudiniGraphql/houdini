import { type ChildProcess, spawn } from 'node:child_process'
import path from 'node:path'
import sqlite from 'node:sqlite'
import { format_hook_error, HookError } from 'src/lib/error'

import * as fs from '../lib/fs'
import { db_path, houdini_root } from './conventions'
import { create_schema, write_config } from './database'
import { type Config } from './project'

export type PluginSpec = {
	name: string
	port: number
	hooks: Set<string>
	order: 'before' | 'after' | 'core'
}

// codegen_setup sets up the codegen pipe before we start generating files. this primarily means starting
// the config server along with each plugin
export async function codegen_setup(
	config: Config,
	mode: string
): Promise<{
	close: () => Promise<void>
	trigger_hook: (name: string, parallel_safe: boolean) => Promise<void>
	database_path: string
}> {
	// We need the root dir before we get to the exciting stuff
	await fs.mkdirpSync(houdini_root(config))

	const plugins: Record<string, PluginSpec & { process: ChildProcess }> = {}

	// when plugins announce themselves, they provide a port
	const plugin_specs: Record<string, PluginSpec> = {}

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
	const db = new sqlite.DatabaseSync(db_file)
	db.exec('PRAGMA journal_mode = WAL')
	db.exec('PRAGMA synchronous = off')
	db.exec('PRAGMA cache_size = 10000')
	db.exec('PRAGMA temp_store = memory')
	db.exec('PRAGMA busy_timeout = 5000')
	db.exec(create_schema)

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
						hooks: new Set(row.hooks.split(',')),
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
			}, 2000)

			// Create a resolver function that clears the timeout
			const resolver = (spec: PluginSpec) => {
				clearTimeout(timeout)
				resolve(spec)
			}
		})

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

	const invoke_hook = async (name: string, hook: string, payload: Record<string, any> = {}) => {
		const { port } = plugin_specs[name]

		// make the request
		const response = await fetch(`http://localhost:${port}/${hook.toLowerCase()}`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(payload),
		})

		// if the request failed, throw an error
		if (!response.ok) {
			if (response.status === 404) {
				throw new Error(`Plugin ${name} does not support hook ${hook}`)
			}
			const responseJSON = await response.json()
      const errors: HookError[]  = Array.isArray(responseJSON)  ? responseJSON : [responseJSON] 
			errors.forEach((error) => {
				format_hook_error(config.root_dir, error)
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
		parallel_safe: boolean,
		payload: Record<string, any> = {}
	) => {
		console.time(hook)
		// look for all of the plugins that have registered for this hook
		const plugins = Object.entries(plugin_specs).filter(([, { hooks }]) => hooks.has(hook))

		// if the hook is parallel safe, we can run all of the plugins in parallel
		if (parallel_safe) {
			await Promise.all(plugins.map(([plugin]) => invoke_hook(plugin, hook, payload)))
		} else {
			// if the hook isn't parallel safe, we need to run the plugins in order
			for (const [name] of plugins) {
				await invoke_hook(name, hook, payload)
			}
		}
		console.timeEnd(hook)
	}

	// write the current config values to the database
	await write_config(db, config, invoke_hook, plugin_specs, mode)

	// now we should load the config hook so other plugins can set their defaults
	await trigger_hook('Config', false)

	// now that we've loaded the environment, we need to invoke the afterLoad hook
	await trigger_hook('AfterLoad', false)

	// add any plugin-specifics to our schema
	await trigger_hook('Schema', false)

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

export async function codegen(
	trigger_hook: (hook: string, parallel_safe: boolean) => Promise<void>
) {
	// step through every hook in the pipeline
	await trigger_hook('ExtractDocuments', false)
	await trigger_hook('AfterExtract', false)
	await trigger_hook('BeforeValidate', false)
	await trigger_hook('Validate', true)
	await trigger_hook('AfterValidate', false)
	await trigger_hook('BeforeGenerate', false)
	await trigger_hook('Generate', true)
}
