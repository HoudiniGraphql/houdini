import { type ChildProcess, spawn } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createInterface } from 'node:readline'
import { WebSocket } from 'ws'

// WASI runner written to a temp file on first use — no extra asset to ship.
// argv[2] = wasmPath, argv[3..] = plugin args forwarded verbatim.
//
// WebContainers (and other sandboxed runtimes) don't support fs.readSync on
// pipe fds (EBADF). Use a worker-thread relay instead:
//   main thread  — process.stdin async events work fine, relay via MessageChannel
//   worker thread — Atomics.wait + receiveMessageOnPort provides real blocking,
//                   custom fd_read feeds WASM without ever touching fd 0 directly.
const wasiRunnerPath = path.join(tmpdir(), 'houdini-wasi-runner.mjs')
writeFileSync(
	wasiRunnerPath,
	`import{WASI}from'node:wasi';
import{readFileSync}from'node:fs';
import{Worker,isMainThread,workerData,MessageChannel,receiveMessageOnPort}from'worker_threads';
const[,,w,...r]=process.argv;
if(isMainThread){
const{port1:p1,port2:p2}=new MessageChannel();
const sb=new Int32Array(new SharedArrayBuffer(4));
process.stdin.on('error',()=>{});
process.stdin.on('data',d=>{p1.postMessage(d);Atomics.add(sb,0,1);Atomics.notify(sb,0);});
process.stdin.on('end',()=>{p1.postMessage(null);Atomics.add(sb,0,1);Atomics.notify(sb,0);});
const wk=new Worker(new URL(import.meta.url),{workerData:{w,r,p:p2,sb},transferList:[p2]});
wk.on('exit',c=>process.exit(c??0));
}else{
const{w:wb,r:args,p:port,sb}=workerData;
const wasi=new WASI({version:'preview1',args:[wb,...args],env:process.env,preopens:{'/':'/'}});
let mem=null;
const io=wasi.getImportObject();
const rfr=io.wasi_snapshot_preview1.fd_read;
io.wasi_snapshot_preview1.fd_read=(fd,iovs,il,nr)=>{
if(fd!==0||!mem)return rfr(fd,iovs,il,nr);
while(Atomics.load(sb,0)===0)Atomics.wait(sb,0,0);
const m=receiveMessageOnPort(port);
Atomics.sub(sb,0,1);
const v=new DataView(mem.buffer);
if(!m||m.message===null){v.setUint32(nr,0,true);return 0;}
const b=Buffer.isBuffer(m.message)?m.message:Buffer.from(m.message);
let wn=0;
for(let i=0;i<il;i++){
const p=v.getUint32(iovs+i*8,true),l=v.getUint32(iovs+i*8+4,true);
const n=Math.min(l,b.length-wn);
if(n<=0)break;
new Uint8Array(mem.buffer,p,n).set(b.subarray(wn,wn+n));
wn+=n;}
v.setUint32(nr,wn,true);
return 0;};
const mod=new WebAssembly.Module(readFileSync(wb));
const inst=new WebAssembly.Instance(mod,io);
mem=inst.exports.memory;
wasi.start(inst);
process.exit(0);}
`
)

import * as conventions from '../router/conventions.js'
import type { Config } from './config.js'
import { create_schema, write_config } from './database.js'
import { type Db, openDb } from './db.js'
import type { HookError } from './error.js'
import { format_hook_error } from './error.js'
import * as fs from './fs.js'
import { Logger } from './logger.js'
import type { ProjectManifest } from './types.js'
import { LogLevel } from './types.js'

// ─── database connection ──────────────────────────────────────────────────────

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

export async function connect_db(config: Config): Promise<[Db, string]> {
	const filepath = conventions.db_path(config)
	const db = await openDb(filepath)
	db.exec(create_schema)
	db.flush()
	return [db, filepath]
}

export async function init_db(config: Config, preserve: boolean): Promise<[Db, string]> {
	const db_file = conventions.db_path(config)

	// we need to create a fresh database for orchestration
	if (!preserve) {
		try {
			await fs.remove(db_file)
		} catch (_e) {}
		try {
			await fs.remove(`${db_file}-shm`)
		} catch (_e) {}
		try {
			await fs.remove(`${db_file}-wal`)
		} catch (_e) {}
	}
	return connect_db(config)
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
	/** Serializes concurrent pipeline runs (HMR vs schema watcher) via a promise chain. */
	pipeline_lock: <T>(fn: () => Promise<T>) => Promise<T>
}

// codegen_setup sets up the codegen pipe before we start generating files. this primarily means starting
// the config server along with each plugin
// Converts a plugin config key to a safe DB registration name.
// Named packages (e.g. 'houdini-svelte') pass through unchanged.
// Local paths (e.g. './plugins/my.mjs') have '.' → '_' and '/' → '__'.
export function plugin_db_key(name: string): string {
	if (!name.startsWith('./') && !name.startsWith('../') && !path.isAbsolute(name)) {
		return name
	}
	return name.replace(/\./g, '_').replace(/\//g, '__')
}

export async function codegen_setup(
	config: Config,
	mode: string,
	db: Db,
	db_file: string
): Promise<CompilerProxy> {
	// _db is the same object as the caller's db (ctx.db). reload() mutates it
	// in-place so the caller always sees the latest state without reassignment.
	const _db = db
	const logger = new Logger(config.config_file.logLevel ?? LogLevel.ShortSummary)

	// We need the root dir before we get to the exciting stuff
	await fs.mkdirpSync(conventions.houdini_root(config))

	const rawTransport = config.config_file.pluginTransport ?? 'websocket'
	const resolvedTransport = rawTransport.startsWith('env:')
		? (process.env[rawTransport.slice('env:'.length)] ?? 'websocket')
		: rawTransport
	const useStdio = resolvedTransport === 'stdio'

	const plugins: Record<string, PluginSpec & { process: ChildProcess }> = {}

	// when plugins announce themselves, they provide a port
	const plugin_specs: Array<PluginSpec> = []
	const spec_results: Record<string, PluginSpec> = {}

	// stdio transport state — populated for plugins spawned with --transport stdio
	const stdioStdin = new Map<string, NodeJS.WritableStream>()
	// invoke messages from Go need to call trigger_hook, which is defined later;
	// we use a ref so the readline handlers close over a mutable binding
	const triggerHookRef: { fn: CompilerProxy['trigger_hook'] | null } = { fn: null }

	// Declared here (before wait_for_plugin_stdio) to avoid TDZ: the close
	// handler in wait_for_plugin_stdio closes over this Map and can fire before
	// the original declaration site (after the plugins-registered await) executes.
	const pendingRequests = new Map<
		string,
		{
			resolve: (value: any) => void
			reject: (reason: any) => void
			timeout: NodeJS.Timeout
			hook: string
			plugin: string
		}
	>()

	// wait_for_plugin_db polls the SQLite file using a dedicated connection until
	// the Go plugin inserts its registration row. Uses a separate pollDb so the
	// main _db is not disturbed during the wait.
	const wait_for_plugin_db = async (configKey: string, dbKey: string): Promise<PluginSpec> => {
		const pollDb = await openDb(db_file)
		return new Promise<PluginSpec>((resolve, reject) => {
			const interval = setInterval(() => {
				pollDb.reload()
				const row = pollDb.get<{
					name: string
					port: number
					hooks: string
					plugin_order: string
					config_module: string | null
				}>('SELECT * FROM plugins WHERE name = ?', [dbKey])

				if (row) {
					clearInterval(interval)
					clearTimeout(timeout)

					pollDb.run('UPDATE plugins SET config = ? WHERE name = ?', [
						JSON.stringify(
							config.plugins.find((p) => p.name === configKey)?.config ?? {}
						),
						dbKey,
					])
					pollDb.flush()
					pollDb.close()

					const spec: PluginSpec = {
						name: row.name,
						port: row.port,
						hooks: new Set(JSON.parse(row.hooks)),
						order: row.plugin_order as 'before' | 'after' | 'core',
						directory:
							config.plugins.find((p) => p.name === configKey)?.directory || '',
					}
					spec_results[configKey] = spec

					if (row.config_module) {
						import(row.config_module).then((module) => {
							if (module && typeof module.default === 'function') {
								config.config_file = module.default(config.config_file)
							}
							resolve(spec)
						})
					} else {
						resolve(spec)
					}
				}
			}, 10)

			const timeout = setTimeout(() => {
				clearInterval(interval)
				pollDb.close()
				reject(new Error(`Timeout waiting for plugin ${configKey} to register`))
			}, 10000)
		})
	}

	// wait_for_plugin_stdio reads the registration JSON line from stdout and sets
	// up the permanent message handler for response/invoke messages.
	// Used for stdio transport plugins.
	const wait_for_plugin_stdio = (name: string, child: ChildProcess) =>
		new Promise<PluginSpec>((resolve, reject) => {
			const timeout = setTimeout(() => {
				reject(new Error(`Timeout waiting for plugin ${name} to register`))
			}, 10000)

			const rl = createInterface({ input: child.stdout! })
			let registered = false

			rl.on('line', (line) => {
				try {
					const msg = JSON.parse(line)

					if (!registered) {
						if (msg.type !== 'register') {
							clearTimeout(timeout)
							reject(new Error(`Plugin ${name} sent ${msg.type} before registering`))
							return
						}
						registered = true
						clearTimeout(timeout)

						const spec: PluginSpec = {
							name: msg.name ?? plugin_db_key(name),
							port: msg.port ?? 0,
							hooks: new Set(msg.hooks ?? []),
							order: msg.order as 'before' | 'after' | 'core',
							directory: config.plugins.find((p) => p.name === name)?.directory || '',
						}
						spec_results[name] = spec

						// WebSocket plugins insert themselves into the DB; for stdio plugins (port=0)
						// we do it here. INSERT OR IGNORE avoids a duplicate-key error either way.
						_db.run(
							`INSERT OR IGNORE INTO plugins (name, hooks, port, plugin_order, include_runtime, config_module, client_plugins)
							 VALUES (?, ?, ?, ?, ?, ?, ?)`,
							[
								spec.name,
								JSON.stringify([...spec.hooks]),
								spec.port,
								spec.order,
								msg.includeRuntime ?? null,
								msg.configModule ?? null,
								msg.clientPlugins ?? null,
							]
						)
						_db.run('UPDATE plugins SET config = ? WHERE name = ?', [
							JSON.stringify(
								config.plugins.find((p) => p.name === name)?.config ?? {}
							),
							spec.name,
						])
						_db.flush()

						if (msg.configModule) {
							import(msg.configModule)
								.then((module) => {
									if (module && typeof module.default === 'function') {
										config.config_file = module.default(config.config_file)
									}
									resolve(spec)
								})
								.catch((err: Error) => {
									reject(
										new Error(
											`Failed to load configModule for ${name}: ${err.message}`
										)
									)
								})
						} else {
							resolve(spec)
						}
						return
					}

					// subsequent messages: response or invoke
					if (msg.type === 'response') {
						const pending = pendingRequests.get(msg.id)
						if (!pending) return
						clearTimeout(pending.timeout)
						pendingRequests.delete(msg.id)

						if (msg.error) {
							const errors: HookError[] = Array.isArray(msg.error)
								? msg.error
								: [msg.error]
							errors.forEach((error) => {
								format_hook_error(config.root_dir, error, name, pending.hook)
							})
							pending.reject(new Error(`Failed to call ${name}`))
						} else {
							pending.resolve(msg.result)
						}
					} else if (msg.type === 'invoke') {
						// Go plugin is asking Node.js to call other plugins on its behalf.
						// triggerHookRef.fn is always set before any hook runs, but guard anyway.
						if (!triggerHookRef.fn) {
							const reply = `${JSON.stringify({
								id: msg.id,
								type: 'invoke_result',
								error: { message: 'orchestrator not ready' },
							})}\n`
							child.stdin?.write(reply)
							return
						}
						triggerHookRef
							.fn(msg.hook, {
								parallel_safe: msg.parallel,
								payload: msg.payload,
								task_id: msg.taskId,
							})
							.then((result) => {
								const reply =
									JSON.stringify({ id: msg.id, type: 'invoke_result', result }) +
									'\n'
								child.stdin?.write(reply)
							})
							.catch((err: Error) => {
								const reply = `${JSON.stringify({
									id: msg.id,
									type: 'invoke_result',
									error: { message: err.message },
								})}\n`
								child.stdin?.write(reply)
							})
					}
				} catch (err: unknown) {
					if (!registered) {
						reject(err instanceof Error ? err : new Error(String(err)))
					}
				}
			})

			rl.on('close', () => {
				if (!registered) {
					clearTimeout(timeout)
					reject(new Error(`Plugin ${name} stdout closed before registering`))
				} else {
					// reject only in-flight requests belonging to this plugin
					for (const [id, pending] of pendingRequests.entries()) {
						if (pending.plugin !== name) continue
						clearTimeout(pending.timeout)
						pendingRequests.delete(id)
						pending.reject(new Error(`Plugin ${name} closed unexpectedly`))
					}
				}
			})
		})

	// delete existing plugin metadata
	_db.run('DELETE FROM plugins')
	_db.flush()

	// start each plugin
	logger.time('Start Plugins')
	await Promise.all(
		config.plugins.map(async (plugin) => {
			let executable = plugin.executable
			const args = ['--database', db_file]

			// Run the plugin through a node shim if it's a javascript plugin
			const jsExtensions = ['.js', '.mjs', '.cjs']
			if (jsExtensions.includes(path.extname(plugin.executable))) {
				executable = 'node'
				args.unshift(plugin.executable)
			} else if (path.extname(plugin.executable) === '.wasm') {
				// WASM plugins always use stdio and run via node:wasi
				executable = 'node'
				args.unshift(wasiRunnerPath, plugin.executable)
			}

			const dbKey = plugin_db_key(plugin.name)
			args.push('--plugin-key', dbKey)
			// WASM plugins always communicate over stdio regardless of the global transport setting
			const pluginUsesStdio = useStdio || path.extname(plugin.executable) === '.wasm'
			if (pluginUsesStdio) {
				args.push('--transport', 'stdio')
			}

			logger.time(`Spawn ${plugin.name}`)
			const child = spawn(executable, args, {
				// [stdin, stdout, stderr]: stdio plugins need piped stdin/stdout for the
				// message protocol; stderr is always inherited so plugin logs reach the terminal.
				stdio: pluginUsesStdio
					? ['pipe', 'pipe', 'inherit']
					: ['inherit', 'inherit', 'inherit'],
				detached: process.platform !== 'win32',
			})

			if (pluginUsesStdio) {
				stdioStdin.set(dbKey, child.stdin!)
				child.stdin!.on('error', (err: Error) => {
					if ((err as NodeJS.ErrnoException).code !== 'EPIPE') {
						console.error(`[${plugin.name}] stdin error:`, err.message)
					}
				})
			}

			plugins[plugin.name] = {
				process: child,
				...(await (pluginUsesStdio
					? wait_for_plugin_stdio(plugin.name, child)
					: wait_for_plugin_db(plugin.name, dbKey))),
			}
			logger.timeEnd(`Spawn ${plugin.name}`, LogLevel.Verbose)
		})
	)

	for (const plugin of config.plugins) {
		plugin_specs.push(spec_results[plugin.name])
	}

	logger.timeEnd('Start Plugins', LogLevel.Summary)

	const wsConnections = new Map<string, WebSocket>()
	let messageCounter = 0

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

		const messageId = String(++messageCounter)
		const message = {
			id: messageId,
			type: 'request',
			hook,
			payload,
			taskId: task_id,
			pluginDirectory: directory,
		}

		if (useStdio) {
			// stdio transport: write newline-delimited JSON to the plugin's stdin
			const stdin = stdioStdin.get(name)
			if (!stdin) {
				throw new Error(`No stdio channel for plugin ${name}`)
			}
			return new Promise((resolve, reject) => {
				const timeout = setTimeout(() => {
					pendingRequests.delete(messageId)
					reject(new Error(`Request timeout for ${name}/${hook}`))
				}, 30000)
				pendingRequests.set(messageId, { resolve, reject, timeout, hook, plugin: name })
				stdin.write(`${JSON.stringify(message)}\n`)
			})
		} else {
			// WebSocket transport: await the connection before registering the pending request
			// so that a connection failure rejects immediately rather than timing out
			const ws = await getOrCreateWS(name, port)
			return new Promise((resolve, reject) => {
				const timeout = setTimeout(() => {
					pendingRequests.delete(messageId)
					reject(new Error(`WebSocket request timeout for ${name}/${hook}`))
				}, 30000)
				pendingRequests.set(messageId, { resolve, reject, timeout, hook, plugin: name })
				ws.send(JSON.stringify(message))
			})
		}
	}

	// Reload from disk so we see rows that WebSocket (Go) plugins inserted directly.
	// reload() mutates _db in-place, so the caller's reference (ctx.db) is also updated.
	_db.reload()

	// Raw dispatch: sends messages to plugins without touching the DB.
	const _fireHook = async (
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
		logger.time(timeName)
		const plugins = plugin_specs.filter(({ hooks }) => hooks.has(hook))
		const result: Record<string, any> = {}
		try {
			if (parallel_safe) {
				await Promise.all(
					plugins.map(async (plugin) => {
						result[plugin.name] = await invoke_hook(plugin.name, hook, payload, task_id)
					})
				)
			} else {
				for (const { name } of plugins) {
					result[name] = await invoke_hook(name, hook, payload, task_id)
				}
			}
		} finally {
			logger.timeEnd(timeName, task_id ? LogLevel.Verbose : LogLevel.Summary)
		}
		return result
	}

	// Synced wrapper: flush before (Go reads JS writes), reload after (JS sees Go writes).
	// flush/reload are no-ops on NativeDb (WAL handles it); on SqlJsDb they save/re-read the file.
	const trigger_hook = async (
		hook: PipelineHook,
		opts?: { parallel_safe?: boolean; payload?: Record<string, any>; task_id?: string }
	) => {
		_db.flush()
		const result = await _fireHook(hook, opts)
		_db.reload()
		return result
	}

	// expose trigger_hook to the stdio invoke handlers
	triggerHookRef.fn = trigger_hook

	// write the current config values to the database
	await write_config(_db, config, invoke_hook, plugin_specs, mode, logger)
	// flush so Go plugins can read config when the Config hook fires
	_db.flush()

	// now we should load the config hook so other plugins can set their defaults
	await trigger_hook('Config')

	// now that we've loaded the environment, we need to invoke the afterLoad hook
	await trigger_hook('AfterLoad')

	// add any plugin-specifics to our schema
	await trigger_hook('Schema')

	let pipelineQueue: Promise<void> = Promise.resolve()

	return {
		database_path: db_file,
		trigger_hook,
		run_pipeline: (options: RunPipelineOptions) => run_pipeline(trigger_hook, options),
		pipeline_lock: <T>(fn: () => Promise<T>): Promise<T> => {
			const result = pipelineQueue.then(fn)
			pipelineQueue = result.then(
				() => {},
				() => {}
			)
			return result
		},
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

			// signal stdio plugins to exit by closing their stdin
			for (const [, stdin] of stdioStdin.entries()) {
				try {
					stdin.end()
				} catch {}
			}
			stdioStdin.clear()

			// reject and clear pending requests
			for (const [, { timeout, reject }] of pendingRequests.entries()) {
				clearTimeout(timeout)
				reject(new Error('codegen closed'))
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
							} catch (_err) {
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
			results.GenerateDocuments = gdResult
			results.GenerateRuntime = grResult
			i++ // GenerateRuntime already handled
			continue
		}

		results[hook] = await trigger_hook(hook, opts)
	}

	return results
}
