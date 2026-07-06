// Pipeline lifecycle: startup, config-change restarts, watched-file
// reconciliation, and shutdown (so editor reloads don't leak Go processes).

import { codegen_setup, get_config, init_db } from 'houdini/lib'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import * as nodePath from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { DidChangeWatchedFilesNotification } from 'vscode-languageserver/node.js'

import { validate } from './diagnostics.js'
import type { ServerState } from './state.js'

// houdini/lib is not a semver-stable surface — this server runs in lockstep with
// the houdini release it shipped alongside. warn loudly when the project's houdini
// has drifted to a different minor.
function warn_on_version_mismatch(state: ServerState, root_dir: string) {
	try {
		const project = createRequire(
			pathToFileURL(nodePath.join(root_dir, 'package.json')).toString()
		)
		const houdini = project('houdini/package.json').version as string
		const own = JSON.parse(
			readFileSync(new URL('../package.json', import.meta.url), 'utf-8')
		).version as string
		const [hMajor, hMinor] = houdini.split('.')
		const [oMajor, oMinor] = own.split('.')
		if (hMajor !== oMajor || hMinor !== oMinor) {
			state.connection.console.error(
				`[houdini-lsp] version mismatch: houdini-lsp@${own} is running against houdini@${houdini}. Keep them on the same minor (update whichever is behind) to avoid subtle breakage.`
			)
		}
	} catch {}
}

export async function setup_compiler(state: ServerState) {
	const config = await get_config({ force_reload: true })
	state.root_dir = config.root_dir
	warn_on_version_mismatch(state, config.root_dir)

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

	// ask capable clients to watch the files the database depends on — this is how
	// every editor (Neovim, Helix, VS Code, ...) delivers didChangeWatchedFiles;
	// clients without dynamic registration simply never send the events and
	// reconcile through saves instead
	connection.onInitialized(async () => {
		if (!state.watch_registration_supported) return
		try {
			await connection.client.register(DidChangeWatchedFilesNotification.type, {
				watchers: [
					{ globPattern: '**/houdini.config.{js,ts,mjs,cjs}' },
					{ globPattern: '**/*.{gql,graphql}' },
					{ globPattern: '**/*.{ts,tsx,js,jsx,svelte}' },
				],
			})
		} catch (err) {
			connection.console.error(`[houdini-lsp] failed to register file watchers: ${err}`)
		}
	})

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
