import { EventEmitter } from 'node:events'
import { test, expect, vi } from 'vitest'

import { document_hmr } from './hmr.js'
import { close_session } from './index.js'
import { dispose_active_session } from './session.js'

// codegen_setup spawns real plugin processes and get_config reads the project config;
// mock both so the test only exercises the plugin's compiler lifecycle wiring.
vi.mock('../lib/index.js', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../lib/index.js')>()
	return {
		...actual,
		get_config: vi.fn(async () => ({ config_file: {} })),
		codegen_setup: vi.fn(async () => fake_compiler()),
	}
})

function fake_compiler() {
	return {
		close: vi.fn(async () => {}),
		run_pipeline: vi.fn(async () => ({})),
		trigger_hook: vi.fn(async () => ({})),
		pipeline_lock: vi.fn((fn: () => Promise<any>) => fn()),
		database_path: '',
	}
}

function fake_ctx(db_file = '/tmp/houdini-test.db') {
	return {
		config: { config_file: {} },
		db: { get: () => ({ count: 0 }), close: vi.fn() },
		db_file,
		teardowns: [],
	} as any
}

// `httpServer: null` models a middlewareMode server, the shape vitest gets, where the
// plugin container is the only thing that can tell houdini to shut down.
function fake_server(httpServer: EventEmitter | null = new EventEmitter()) {
	return {
		config: { root: '/project' },
		httpServer,
		environments: { client: { name: 'client' }, ssr: { name: 'ssr' } },
	} as any
}

// vite calls buildEnd with a plugin context whose environment belongs to the server
// being closed, and only for the client environment
function close_from_vite(closePlugin: any, server: any) {
	return closePlugin.buildEnd.call({ environment: server.environments.client })
}

// Vite restarts re-run the config file (fresh plugin instance and context per server)
// but create the replacement server *before* closing the old one. The old server's
// close handler must tear down only its own compiler — a shared module-level reference
// would point at the replacement's compiler by then and close its database out from
// under it ("database is not open" on every subsequent HMR run).
test('a vite restart does not close the replacement compiler', async () => {
	const oldCtx = fake_ctx()
	const newCtx = fake_ctx()
	const oldPlugin: any = document_hmr(oldCtx)
	const newPlugin: any = document_hmr(newCtx)
	const oldClose: any = close_session(oldCtx)
	const newClose: any = close_session(newCtx)

	const oldServer = fake_server()
	const newServer = fake_server()
	await oldPlugin.configureServer(oldServer)
	await oldClose.configureServer(oldServer)
	// capture before the replacement configures: its session handoff disposes
	// the old session and clears the old context's reference
	const oldCompiler = oldCtx.compiler
	await newPlugin.configureServer(newServer)
	await newClose.configureServer(newServer)

	const newCompiler = newCtx.compiler
	expect(oldCompiler).toBeDefined()
	expect(newCompiler).toBeDefined()
	expect(oldCompiler).not.toBe(newCompiler)

	// the old server closes after the replacement is already configured
	oldServer.httpServer.emit('close')

	expect(oldCompiler.close).toHaveBeenCalledTimes(1)
	expect(newCompiler.close).not.toHaveBeenCalled()
	// the closed server's reference is cleared so pending debounce work no-ops
	// instead of running against a closed database
	expect(oldCtx.compiler).toBeUndefined()
	expect(newCtx.compiler).toBe(newCompiler)
})

// The replacement session must be able to tear down its predecessor *before*
// recreating the database and spawning its own plugin processes — otherwise the
// two sessions race on plugin registration and the survivor can end up dialing
// dead plugin ports. houdini.ts's configResolved performs this handoff through
// dispose_active_session; the old server's eventual close must then be a no-op.
test('a replacement session disposes its predecessor before taking over', async () => {
	const dbFile = '/tmp/houdini-handoff-test.db'
	const oldCtx = fake_ctx(dbFile)
	const oldPlugin: any = document_hmr(oldCtx)
	const oldClose: any = close_session(oldCtx)
	const oldServer = fake_server()
	await oldPlugin.configureServer(oldServer)
	await oldClose.configureServer(oldServer)
	const oldCompiler = oldCtx.compiler

	// the replacement generation runs the handoff before init_db recreates the file
	await dispose_active_session(dbFile)
	expect(oldCompiler.close).toHaveBeenCalledTimes(1)
	expect(oldCtx.compiler).toBeUndefined()

	// then it configures its own session
	const newCtx = fake_ctx(dbFile)
	const newPlugin: any = document_hmr(newCtx)
	const newClose: any = close_session(newCtx)
	const newServer = fake_server()
	await newPlugin.configureServer(newServer)
	await newClose.configureServer(newServer)
	const newCompiler = newCtx.compiler
	expect(newCompiler).toBeDefined()

	// when vite finally closes the old server, the handoff already happened —
	// its close handler must not tear anything down again
	oldServer.httpServer.emit('close')
	await new Promise((resolve) => setImmediate(resolve))
	expect(oldCompiler.close).toHaveBeenCalledTimes(1)
	expect(newCompiler.close).not.toHaveBeenCalled()
	expect(newCtx.compiler).toBe(newCompiler)
})

// The http server's 'close' event alone left an embedded dev server's plugin
// processes running with their websockets open, which kept node from exiting.
test('closing a middleware-mode server shuts the session down', async () => {
	const ctx = fake_ctx('/tmp/houdini-middleware-test.db')
	const plugin: any = document_hmr(ctx)
	const closePlugin: any = close_session(ctx)

	const server = fake_server(null)
	await plugin.configureServer(server)
	await closePlugin.configureServer(server)
	const compiler = ctx.compiler
	expect(compiler).toBeDefined()

	await close_from_vite(closePlugin, server)

	expect(compiler.close).toHaveBeenCalledTimes(1)
	expect(ctx.db.close).toHaveBeenCalledTimes(1)
	expect(ctx.compiler).toBeUndefined()
})

// server.close() closes the http server and the plugin container concurrently, so one
// shutdown delivers both signals.
test('a shutdown that arrives on both signals tears down once', async () => {
	const ctx = fake_ctx('/tmp/houdini-repeat-close-test.db')
	const plugin: any = document_hmr(ctx)
	const closePlugin: any = close_session(ctx)

	const server = fake_server()
	await plugin.configureServer(server)
	await closePlugin.configureServer(server)
	const compiler = ctx.compiler

	server.httpServer.emit('close')
	await close_from_vite(closePlugin, server)

	expect(compiler.close).toHaveBeenCalledTimes(1)
	expect(ctx.db.close).toHaveBeenCalledTimes(1)
})

// Production builds must not tear down in buildEnd. Vite doesn't always await async
// buildStart hooks, so codegen_setup can still be polling the database when buildEnd
// fires, and closing it out from under that poll ends in a registration timeout.
test('a production build leaves the database open in buildEnd', async () => {
	const ctx = fake_ctx('/tmp/houdini-build-test.db')
	const closePlugin: any = close_session(ctx)

	// no configureServer, because there is no dev server during a build
	await closePlugin.buildEnd.call({ environment: { name: 'client' } })

	expect(ctx.db.close).not.toHaveBeenCalled()
})

// An embedder that passes plugin objects through an inline config gets the same
// objects, and the same ctx, handed to the server that replaces them on a restart.
// Teardown state on the plugin instance would let the old server's close drain the
// replacement's session and kill a compiler that is still serving.
test("a reused plugin instance keeps the two servers' shutdowns apart", async () => {
	const ctx = fake_ctx('/tmp/houdini-reuse-test.db')
	const plugin: any = document_hmr(ctx)
	const closePlugin: any = close_session(ctx)

	const oldServer = fake_server()
	await plugin.configureServer(oldServer)
	await closePlugin.configureServer(oldServer)
	const oldCompiler = ctx.compiler

	// the replacement configures while the old server is still up
	const newServer = fake_server()
	await plugin.configureServer(newServer)
	await closePlugin.configureServer(newServer)
	const newCompiler = ctx.compiler

	expect(newCompiler).not.toBe(oldCompiler)
	// the handoff in configureServer already disposed the old session
	expect(oldCompiler.close).toHaveBeenCalledTimes(1)

	// closing the old server must leave the replacement running
	await close_from_vite(closePlugin, oldServer)
	oldServer.httpServer.emit('close')

	expect(newCompiler.close).not.toHaveBeenCalled()
	expect(ctx.compiler).toBe(newCompiler)

	// and the replacement can still tear itself down afterwards
	await close_from_vite(closePlugin, newServer)
	expect(newCompiler.close).toHaveBeenCalledTimes(1)
})
