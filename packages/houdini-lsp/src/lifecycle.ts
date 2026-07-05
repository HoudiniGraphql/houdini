// Pipeline lifecycle: startup, config-change restarts, watched-file
// reconciliation, and shutdown (so editor reloads don't leak Go processes).

import { codegen_setup, get_config, init_db } from 'houdini/lib'
import * as nodePath from 'node:path'
import { fileURLToPath } from 'node:url'

import { validate } from './diagnostics.js'
import type { ServerState } from './state.js'

export async function setup_compiler(state: ServerState) {
	const config = await get_config({ force_reload: true })
	state.root_dir = config.root_dir

	const lspDb = nodePath.join(
		config.root_dir,
		config.config_file.runtimeDir ?? '.houdini',
		'lsp.db'
	)
	const [db, dbFile] = await init_db(config, false, lspDb)
	state.db = db

	state.compiler = await codegen_setup(config, 'development', db, dbFile)

	// run the pipeline once so the schema and fragment list are live before the
	// first save — completions and hover work as soon as the editor opens
	await validate(state)

	state.connection.console.log('[houdini-lsp] ready')
}

// tear down the pipeline (config server + plugin processes)
export async function teardown(state: ServerState) {
	for (const timer of state.live_timers.values()) {
		clearTimeout(timer)
	}
	state.live_timers.clear()

	const active = state.compiler
	state.compiler = null
	state.schema = null
	try {
		await active?.close()
	} catch {}
	try {
		state.db?.close()
	} catch {}
	state.db = null
}

async function restart_compiler(state: ServerState) {
	state.connection.console.log('[houdini-lsp] config changed — restarting pipeline')
	await teardown(state)
	state.ready = setup_compiler(state).catch((err: Error) => {
		state.connection.console.error(`[houdini-lsp] failed to restart: ${err.message}`)
	})
	await state.ready
}

export function register_lifecycle(state: ServerState) {
	const { connection } = state

	// the database otherwise only learns about changes through the editor: a git
	// checkout, a codegen run, or a config edit would leave it stale until some save
	let watch_timer: ReturnType<typeof setTimeout> | null = null
	let watch_restart = false

	connection.onDidChangeWatchedFiles(async (params) => {
		await state.ready

		let relevant = false
		for (const change of params.changes) {
			const base = nodePath.basename(fileURLToPath(change.uri))
			if (base.startsWith('houdini.config.')) {
				watch_restart = true
				relevant = true
				continue
			}
			// open documents reconcile through didSave and live validation
			if (state.documents.get(change.uri)) continue
			relevant = true
		}
		if (!relevant) return

		// coalesce bursts (git checkout touches many files at once)
		if (watch_timer) clearTimeout(watch_timer)
		watch_timer = setTimeout(async () => {
			watch_timer = null
			const restart = watch_restart
			watch_restart = false
			try {
				if (restart) {
					await restart_compiler(state)
				} else {
					// a full run re-walks the project: new files load, deleted files'
					// rows are cleaned up, and the schema file is re-read
					await validate(state)
				}
			} catch (err) {
				connection.console.error(
					`[houdini-lsp] watched-file reconciliation failed: ${err}`
				)
			}
		}, 500)
	})

	connection.onShutdown(async () => {
		await teardown(state)
	})

	connection.onExit(() => {
		process.exit(0)
	})
}
