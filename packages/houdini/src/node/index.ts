import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import http from 'node:http'
import { dirname, join } from 'node:path'
import { createInterface } from 'node:readline'
import { WebSocketServer } from 'ws'

import { openDb, type Db } from '../lib/db.js'
export type { Db } from '../lib/db.js'

export type PipelineHook =
	| 'config'
	| 'afterLoad'
	| 'schema'
	| 'extractDocuments'
	| 'afterExtract'
	| 'beforeValidate'
	| 'validate'
	| 'afterValidate'
	| 'beforeGenerate'
	| 'generateDocuments'
	| 'generateRuntime'
	| 'afterGenerate'
	| 'environment'
	| 'indexFile'

export type PluginContext = {
	taskId: string
	pluginDirectory: string
	db: Db
	invokeHook(
		hook: string,
		payload?: Record<string, any>,
		options?: { parallel?: boolean }
	): Promise<Record<string, any>>
}

export type TransformFn = (source: string, content: string) => Promise<string> | string

export type HookHandler = (
	ctx: PluginContext,
	payload: Record<string, any>
) =>
	| Promise<Record<string, any> | string[] | string | undefined>
	| Record<string, any>
	| string[]
	| string
	| undefined

export type NodePluginConfig = {
	name: string
	order: 'before' | 'after' | 'core'
	hooks: Partial<Record<PipelineHook, HookHandler>>
	includeRuntime?: string
	staticRuntime?: string
	transformRuntime?: TransformFn
	transformStaticRuntime?: TransformFn
	configModule?: string
	clientPlugins?: Record<string, any>
}

// Thrown from hook handlers to send structured errors back to the orchestrator
export class PluginError extends Error {
	detail?: string
	locations?: Array<{ filepath: string; line?: number; column?: number }>
	kind?: string

	constructor(opts: {
		message: string
		detail?: string
		locations?: Array<{ filepath: string; line?: number; column?: number }>
		kind?: string
	}) {
		super(opts.message)
		this.detail = opts.detail
		this.locations = opts.locations
		this.kind = opts.kind
	}
}

export function plugin(config: NodePluginConfig): void {
	const { transport, database, pluginKey } = parseArgs()

	if (transport === 'stdio') {
		void runStdio(config, database, pluginKey)
	} else {
		void runWebSocket(config, database, pluginKey)
	}
}

// ─── stdio transport ──────────────────────────────────────────────────────────

async function runStdio(
	config: NodePluginConfig,
	databasePath: string,
	pluginKey: string
): Promise<void> {
	const resolvedName = pluginKey || config.name
	const { pending, invokeCounter, rl } = makeStdioChannel()

	const wireHooks = registeredHookNames(config).map(toWireName)
	const reg: Record<string, any> = {
		type: 'register',
		name: resolvedName,
		hooks: wireHooks,
		order: config.order,
	}
	if (config.includeRuntime !== undefined) reg.includeRuntime = config.includeRuntime
	if (config.staticRuntime !== undefined) reg.includeStaticRuntime = config.staticRuntime
	if (config.configModule !== undefined) reg.configModule = config.configModule
	if (config.clientPlugins !== undefined) reg.clientPlugins = JSON.stringify(config.clientPlugins)

	stdioWrite(reg)

	// Start opening the db but don't await yet — the line handler awaits it per-message
	// so that the register write and rl listener setup both happen synchronously.
	const dbPromise = openDb(databasePath || ':memory:')

	rl.on('line', async (line) => {
		const db = await dbPromise
		let msg: any
		try {
			msg = JSON.parse(line)
		} catch {
			return
		}

		if (msg.type === 'request') {
			const ctx: PluginContext = {
				taskId: msg.taskId ?? '',
				pluginDirectory: msg.pluginDirectory ?? '',
				db,
				invokeHook: makeInvokeHook(pending, invokeCounter, msg.taskId ?? ''),
			}
			await dispatch(config, resolvedName, msg, ctx, (response) => stdioWrite(response))
		} else if (msg.type === 'invoke_result') {
			resolveInvoke(pending, msg)
		}
	})

	const db = await dbPromise

	rl.on('close', () => {
		for (const { reject } of pending.values()) {
			reject(new Error('stdin closed'))
		}
		pending.clear()
		db.close()
		process.exit(0)
	})
}

// ─── WebSocket transport ──────────────────────────────────────────────────────

async function runWebSocket(
	config: NodePluginConfig,
	databasePath: string,
	pluginKey: string
): Promise<void> {
	if (!databasePath) {
		process.stderr.write('node plugin: --database path is required in websocket mode\n')
		process.exit(1)
	}

	const resolvedName = pluginKey || config.name
	const db = await openDb(databasePath)
	const wireHooks = registeredHookNames(config).map(toWireName)

	const wsInvokeHook: PluginContext['invokeHook'] = () => {
		throw new Error('invokeHook is not supported in websocket transport')
	}

	const server = http.createServer((req, res) => {
		if (req.method !== 'POST') {
			res.writeHead(405)
			res.end()
			return
		}

		const hookName = (req.url ?? '/').slice(1)
		const taskId = (req.headers['x-task-id'] as string) ?? ''
		const pluginDirectory = (req.headers['x-plugin-directory'] as string) ?? ''

		let body = ''
		req.on('data', (chunk) => (body += chunk))
		req.on('end', async () => {
			let payload: Record<string, any> = {}
			try {
				if (body) payload = JSON.parse(body)
			} catch {}

			const msg = { hook: hookName, payload, taskId, pluginDirectory, id: '' }
			const ctx: PluginContext = {
				taskId,
				pluginDirectory,
				db,
				invokeHook: wsInvokeHook,
			}

			await dispatch(config, resolvedName, msg, ctx, (response) => {
				if (response.error) {
					res.writeHead(500, { 'Content-Type': 'application/json' })
					res.end(JSON.stringify(response.error))
				} else {
					res.writeHead(200, { 'Content-Type': 'application/json' })
					res.end(JSON.stringify(response.result ?? {}))
				}
			})
		})
	})

	const wss = new WebSocketServer({ server, path: '/ws' })

	wss.on('connection', (ws) => {
		ws.on('message', async (data) => {
			let msg: any
			try {
				msg = JSON.parse(data.toString())
			} catch {
				return
			}

			if (msg.type !== 'request') {
				ws.send(
					JSON.stringify({
						id: msg.id,
						type: 'response',
						error: { message: 'expected request type' },
					})
				)
				return
			}

			const ctx: PluginContext = {
				taskId: msg.taskId ?? '',
				pluginDirectory: msg.pluginDirectory ?? '',
				db,
				invokeHook: wsInvokeHook,
			}
			await dispatch(config, resolvedName, msg, ctx, (response) =>
				ws.send(JSON.stringify(response))
			)
		})

		ws.on('close', () => {
			db.close()
			server.close()
			process.exit(0)
		})
	})

	server.on('error', (err: Error) => {
		process.stderr.write(`node plugin: server failed to start: ${err.message}\n`)
		process.exit(1)
	})
	server.listen(0, () => {
		const port = (server.address() as { port: number }).port

		// Write to the DB so the orchestrator (and Go plugins) can find us.
		db.run(
			`INSERT INTO plugins (name, hooks, port, plugin_order, include_runtime, include_static_runtime, config_module, client_plugins)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				resolvedName,
				JSON.stringify(wireHooks),
				port,
				config.order,
				config.includeRuntime ?? null,
				config.staticRuntime ?? null,
				config.configModule ?? null,
				config.clientPlugins ? JSON.stringify(config.clientPlugins) : null,
			]
		)
		db.flush()
	})

	process.on('SIGINT', () => shutdown(db, server))
	process.on('SIGTERM', () => shutdown(db, server))
}

// ─── hook dispatch ────────────────────────────────────────────────────────────

async function dispatch(
	config: NodePluginConfig,
	pluginName: string,
	msg: {
		id: string
		hook: string
		payload: Record<string, any>
		taskId: string
		pluginDirectory: string
	},
	ctx: PluginContext,
	send: (response: Record<string, any>) => void
): Promise<void> {
	const normalized = msg.hook.toLowerCase()
	const payload = msg.payload ?? {}

	try {
		let result: any

		switch (normalized) {
			case 'config': {
				// Always handled. Equivalent to Go's DefaultConfig: return plugin config defaults.
				const handler = config.hooks.config
				result = handler ? await handler(ctx, payload) : undefined
				break
			}
			case 'afterload': {
				result = await dispatchAfterLoad(config, pluginName, ctx, payload)
				break
			}
			case 'generateruntime': {
				result = await dispatchGenerateRuntime(config, pluginName, ctx, payload)
				break
			}
			case 'indexfile': {
				await dispatchIndexFile(config, pluginName, ctx, payload)
				result = undefined
				break
			}
			default: {
				const hookKey = (Object.keys(config.hooks) as PipelineHook[]).find(
					(k) => k.toLowerCase() === normalized
				)
				const handler = hookKey ? config.hooks[hookKey] : undefined
				if (!handler) {
					send({
						id: msg.id,
						type: 'response',
						error: { message: `no handler for hook ${msg.hook}` },
					})
					return
				}
				result = await handler(ctx, payload)
			}
		}

		send({ id: msg.id, type: 'response', result: result ?? {} })
	} catch (err) {
		send({ id: msg.id, type: 'response', error: serializeError(err) })
	}
}

// Equivalent to Go's handleAfterLoad:
// 1. DefaultConfig (config hook) → UPDATE plugins SET config in DB
// 2. StaticRuntime (staticRuntime field) → copy static files into plugins/<name>/static
// 3. AfterLoad (afterLoad hook) → call user hook
async function dispatchAfterLoad(
	config: NodePluginConfig,
	pluginName: string,
	ctx: PluginContext,
	payload: Record<string, any>
): Promise<Record<string, any> | undefined> {
	if (config.hooks.config) {
		const defaults = await config.hooks.config(ctx, payload)
		if (defaults !== undefined) {
			ctx.db.run('UPDATE plugins SET config = $config WHERE name = $name', {
				$config: JSON.stringify(defaults),
				$name: pluginName,
			})
		}
	}

	if (config.staticRuntime) {
		const { projectRoot, runtimeDir } = readProjectConfig(ctx.db)
		const src = join(ctx.pluginDirectory, config.staticRuntime)
		const dst = pluginStaticRuntimeDir(projectRoot, runtimeDir, pluginName)
		await recursiveCopy(src, dst, config.transformStaticRuntime)
	}

	if (config.hooks.afterLoad) {
		return (await config.hooks.afterLoad(ctx, payload)) as Record<string, any> | undefined
	}

	return undefined
}

// Equivalent to Go's handleGenerateRuntime:
// 1. IncludeRuntime (includeRuntime field) → copy runtime files into plugins/<name>/runtime
// 2. GenerateRuntime (generateRuntime hook) → call user hook, collect file paths
// Returns the list of written file paths ([]string equivalent).
async function dispatchGenerateRuntime(
	config: NodePluginConfig,
	pluginName: string,
	ctx: PluginContext,
	payload: Record<string, any>
): Promise<string[]> {
	const paths: string[] = []

	if (config.includeRuntime !== undefined) {
		const { projectRoot, runtimeDir } = readProjectConfig(ctx.db)
		const src = join(ctx.pluginDirectory, config.includeRuntime)
		const dst = pluginRuntimeDir(projectRoot, runtimeDir, pluginName)
		const copied = await recursiveCopy(src, dst, config.transformRuntime)
		paths.push(...copied)
	}

	if (config.hooks.generateRuntime) {
		const result = await config.hooks.generateRuntime(ctx, payload)
		if (Array.isArray(result)) {
			paths.push(...result)
		}
	}

	return paths
}

// Equivalent to Go's handleIndexFile:
// 1. Derive the index.ts path from project config
// 2. Call the user's indexFile hook to get content to append
// 3. Read existing content, append, write back
async function dispatchIndexFile(
	config: NodePluginConfig,
	pluginName: string,
	ctx: PluginContext,
	payload: Record<string, any>
): Promise<void> {
	if (!config.hooks.indexFile) return

	const { projectRoot, runtimeDir } = readProjectConfig(ctx.db)
	const targetPath = join(projectRoot, runtimeDir, 'index.ts')

	const content = await config.hooks.indexFile(ctx, { ...payload, filepath: targetPath })
	if (typeof content === 'string' && content) {
		const existing = existsSync(targetPath) ? readFileSync(targetPath, 'utf8') : ''
		mkdirSync(dirname(targetPath), { recursive: true })
		writeFileSync(targetPath, existing + '\n' + content, 'utf8')
	}
}

// ─── project config helpers ───────────────────────────────────────────────────

function readProjectConfig(db: Db): { projectRoot: string; runtimeDir: string } {
	const row = db.get<{ project_root: string; runtime_dir: string }>(
		'SELECT project_root, runtime_dir FROM config LIMIT 1'
	)
	return { projectRoot: row?.project_root ?? '', runtimeDir: row?.runtime_dir ?? '' }
}

// Mirrors Go's ProjectConfig.PluginRuntimeDirectory.
function pluginRuntimeDir(projectRoot: string, runtimeDir: string, name: string): string {
	if (name === 'houdini-core') {
		return join(projectRoot, runtimeDir, 'runtime')
	}
	return join(projectRoot, runtimeDir, 'plugins', name, 'runtime')
}

// Mirrors Go's ProjectConfig.PluginStaticRuntimeDirectory.
function pluginStaticRuntimeDir(projectRoot: string, runtimeDir: string, name: string): string {
	return join(projectRoot, runtimeDir, 'plugins', name, 'static')
}

// Mirrors Go's RecursiveCopy: walks src, copies each file to dst, applying transform.
async function recursiveCopy(
	src: string,
	dst: string,
	transform?: TransformFn
): Promise<string[]> {
	const written: string[] = []
	if (!existsSync(src)) return written

	const walk = async (srcDir: string, dstDir: string) => {
		mkdirSync(dstDir, { recursive: true })
		for (const entry of readdirSync(srcDir)) {
			const srcPath = join(srcDir, entry)
			const dstPath = join(dstDir, entry)
			if (statSync(srcPath).isDirectory()) {
				await walk(srcPath, dstPath)
			} else {
				let content = readFileSync(srcPath, 'utf8')
				if (transform) content = await transform(srcPath, content)
				mkdirSync(dirname(dstPath), { recursive: true })
				writeFileSync(dstPath, content, 'utf8')
				written.push(dstPath)
			}
		}
	}

	await walk(src, dst)
	return written
}

// ─── registered hook names ────────────────────────────────────────────────────

// Mirrors Go's registerPluginHooks registration conditions.
function registeredHookNames(config: NodePluginConfig): string[] {
	const names = new Set<string>()

	// Config is always registered (Go registers it unconditionally).
	names.add('config')

	// AfterLoad: staticRuntime (StaticRuntime) OR afterLoad hook (AfterLoad) OR config hook (DefaultConfig).
	if (config.staticRuntime || config.hooks.afterLoad || config.hooks.config) {
		names.add('afterLoad')
	}

	// GenerateRuntime: includeRuntime (IncludeRuntime) OR generateRuntime hook (GenerateRuntime) OR configModule (Config).
	if (
		config.includeRuntime !== undefined ||
		config.hooks.generateRuntime ||
		config.configModule !== undefined
	) {
		names.add('generateRuntime')
	}

	// All other user-provided hooks (including environment, indexFile, and any that
	// were already added above — Set deduplicates).
	for (const key of Object.keys(config.hooks) as PipelineHook[]) {
		if (typeof config.hooks[key] === 'function') {
			names.add(key)
		}
	}

	return Array.from(names)
}

// ─── shared helpers ───────────────────────────────────────────────────────────

type PendingMap = Map<string, { resolve: (r: any) => void; reject: (e: any) => void }>
type InvokeCounter = { value: number }

function makeStdioChannel() {
	const pending: PendingMap = new Map()
	const invokeCounter: InvokeCounter = { value: 0 }
	const rl = createInterface({ input: process.stdin })
	return { pending, invokeCounter, rl }
}

function makeInvokeHook(
	pending: PendingMap,
	counter: InvokeCounter,
	taskId: string
): PluginContext['invokeHook'] {
	return (hook, payload, opts) =>
		new Promise((resolve, reject) => {
			const id = `node-invoke-${++counter.value}`
			pending.set(id, { resolve, reject })
			stdioWrite({
				id,
				type: 'invoke',
				hook: toWireName(hook),
				payload: payload ?? {},
				taskId,
				parallel: opts?.parallel ?? false,
			})
		})
}

function resolveInvoke(pending: PendingMap, msg: any) {
	const entry = pending.get(msg.id)
	if (!entry) return
	pending.delete(msg.id)
	if (msg.error) {
		const message =
			typeof msg.error === 'string' ? msg.error : (msg.error?.message ?? 'invoke error')
		entry.reject(new Error(message))
	} else {
		entry.resolve(msg.result ?? {})
	}
}

function shutdown(db: Db, server: http.Server): void {
	try {
		db.close()
	} catch {}
	server.close()
	process.exit(0)
}

function parseArgs(): { transport: string; database: string; pluginKey: string } {
	const argv = process.argv
	let transport = 'websocket'
	let database = ''
	let pluginKey = ''
	for (let i = 2; i < argv.length; i++) {
		if (argv[i] === '--transport' && i + 1 < argv.length) transport = argv[++i]
		else if (argv[i] === '--database' && i + 1 < argv.length) database = argv[++i]
		else if (argv[i] === '--plugin-key' && i + 1 < argv.length) pluginKey = argv[++i]
	}
	return { transport, database, pluginKey }
}

function stdioWrite(obj: Record<string, any>): void {
	process.stdout.write(`${JSON.stringify(obj)}\n`)
}

// 'afterLoad' → 'AfterLoad'
function toWireName(name: string): string {
	return name.charAt(0).toUpperCase() + name.slice(1)
}

function serializeError(err: unknown): Record<string, any> {
	if (err instanceof PluginError) {
		const out: Record<string, any> = { message: err.message }
		if (err.detail) out.detail = err.detail
		if (err.locations) out.locations = err.locations
		if (err.kind) out.kind = err.kind
		return out
	}
	if (err instanceof Error) return { message: err.message }
	return { message: String(err) }
}
