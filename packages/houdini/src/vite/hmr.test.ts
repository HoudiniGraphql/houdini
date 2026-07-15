import { EventEmitter } from 'node:events'
import { test, expect, vi } from 'vitest'

import { document_hmr } from './hmr.js'
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
		db: { get: () => ({ count: 0 }) },
		db_file,
	} as any
}

function fake_server() {
	return {
		config: { root: '/project' },
		httpServer: new EventEmitter(),
	} as any
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

	const oldServer = fake_server()
	const newServer = fake_server()
	await oldPlugin.configureServer(oldServer)
	// capture before the replacement configures: its session handoff disposes
	// the old session and clears the old context's reference
	const oldCompiler = oldCtx.compiler
	await newPlugin.configureServer(newServer)

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
	const oldServer = fake_server()
	await oldPlugin.configureServer(oldServer)
	const oldCompiler = oldCtx.compiler

	// the replacement generation runs the handoff before init_db recreates the file
	await dispose_active_session(dbFile)
	expect(oldCompiler.close).toHaveBeenCalledTimes(1)
	expect(oldCtx.compiler).toBeUndefined()

	// then it configures its own session
	const newCtx = fake_ctx(dbFile)
	const newPlugin: any = document_hmr(newCtx)
	const newServer = fake_server()
	await newPlugin.configureServer(newServer)
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
