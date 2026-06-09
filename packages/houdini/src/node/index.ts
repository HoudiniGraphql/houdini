import http from 'node:http'
import { createInterface } from 'node:readline'
import { openDb, type Db } from '../lib/db.js'
export type { Db } from '../lib/db.js'
import { WebSocketServer } from 'ws'

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

export type HookHandler = (
	ctx: PluginContext,
	payload: Record<string, any>
) => Promise<Record<string, any> | undefined> | Record<string, any> | undefined

export type NodePluginConfig = {
	name: string
	order: 'before' | 'after' | 'core'
	hooks: Partial<Record<PipelineHook, HookHandler>>
	includeRuntime?: string
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
	const { pending, invokeCounter, rl } = makeStdioChannel()

	const reg: Record<string, any> = {
		type: 'register',
		name: pluginKey || config.name,
		hooks: hookKeys(config).map(toWireName),
		order: config.order,
	}
	if (config.includeRuntime !== undefined) reg.includeRuntime = config.includeRuntime
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
			await dispatch(config, msg, ctx, (response) => stdioWrite(response))
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

	const db = await openDb(databasePath)
	const wireHooks = hookKeys(config).map(toWireName)

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

			await dispatch(config, msg, ctx, (response) => {
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
			await dispatch(config, msg, ctx, (response) => ws.send(JSON.stringify(response)))
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
			`INSERT INTO plugins (name, hooks, port, plugin_order, include_runtime, config_module, client_plugins)
			 VALUES (?, ?, ?, ?, ?, ?, ?)`,
			[
				pluginKey || config.name,
				JSON.stringify(wireHooks),
				port,
				config.order,
				config.includeRuntime ?? null,
				config.configModule ?? null,
				config.clientPlugins ? JSON.stringify(config.clientPlugins) : null,
			]
		)
		db.flush()
	})

	process.on('SIGINT', () => shutdown(db, server))
	process.on('SIGTERM', () => shutdown(db, server))
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

async function dispatch(
	config: NodePluginConfig,
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
	const normalizedHook = msg.hook.toLowerCase()
	const hookKey = (Object.keys(config.hooks) as PipelineHook[]).find(
		(k) => k.toLowerCase() === normalizedHook
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

	try {
		const result = await handler(ctx, msg.payload ?? {})
		send({ id: msg.id, type: 'response', result: result ?? {} })
	} catch (err) {
		send({ id: msg.id, type: 'response', error: serializeError(err) })
	}
}

function hookKeys(config: NodePluginConfig): string[] {
	return Object.keys(config.hooks).filter(
		(k) => typeof config.hooks[k as PipelineHook] === 'function'
	)
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
