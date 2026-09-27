import * as fs from 'node:fs'
import { createRequire } from 'node:module'
import * as path from 'node:path'
import type { Db } from '../lib/db.js'
import { pathToFileURL } from 'node:url'
import type { PluginOption } from 'vite'

import {
	get_config,
	type Adapter,
	type CompilerProxy,
	type ConfigFile,
	type Config,
} from '../lib/index.js'
import { db_path } from '../router/conventions.js'
import { document_hmr } from './hmr.js'
import { houdini } from './houdini.js'
import { poll_remote_schema, watch_local_schema, refresh_on_schema } from './schema.js'

export type PluginConfig = {
	configPath?: string
	adapter?: Adapter
} & Partial<ConfigFile>

export type VitePluginContext = PluginConfig & {
	db: Db
	db_file: string
	config: Config
	// the dev-server compiler, assigned in document_hmr's configureServer. Lives on the
	// shared context (not module state) so a vite restart — which re-runs the plugin
	// factory and creates a fresh context — can't leak one server's compiler into another.
	compiler?: CompilerProxy
	// shutdown work registered by the plugins sharing this context, drained by
	// close_session. Scoped to the context for the same reason as `compiler`: a vite
	// restart must not let one generation's shutdown reach the session that replaced it.
	teardowns: Array<() => void | Promise<void>>
}

export default async function (opts?: PluginConfig): Promise<Array<PluginOption>> {
	// load the current config
	const config = await get_config()

	// The orchestration DB is opened lazily in the houdini plugin's configResolved hook, not
	// here: that lets us skip it for worker builds (vite `worker.plugins`), which must not open
	// or recreate a second connection to the same SQLite file while the main build is using it
	// (it races the main build and throws a disk I/O error — see #1703). We only need the path
	// up front so the sub-plugins can reference it. The main build still starts from a fresh DB.
	const db_file = db_path(config)

	// build up the arguments we'll pass to the sub-plugins
	const ctx: VitePluginContext = {
		...opts,
		config,
		db_file,
		// assigned in houdini()'s configResolved; never opened for worker builds
		db: undefined as unknown as Db,
		teardowns: [],
		// pick up adapter from config file if not provided in opts
		adapter: opts?.adapter ?? (config.config_file as any).adapter,
	}

	return [
		houdini(ctx),
		watch_local_schema(ctx),
		document_hmr(ctx),
		poll_remote_schema(ctx),
		refresh_on_schema(ctx),
		// each registered plugin could provide a vite portion
		...(await load_vite_plugins(ctx)),
		close_session(ctx),
	]
}

/**
 * Drains the shutdown work registered for a server, then closes the database.
 *
 * The signal comes from buildEnd rather than the http server's 'close' event because
 * a middlewareMode server has no http server. Vitest closed its vite server and the
 * plugin processes kept running with their sockets open, so node never exited.
 * server.close() always closes the plugin container, and it closes the http server
 * concurrently, so both signals can arrive for one shutdown. The latch below makes
 * whichever loses a no-op.
 */
export function close_session(ctx: VitePluginContext): PluginOption {
	type Session = {
		teardowns: Array<() => void | Promise<void>>
		draining?: Promise<void>
	}

	// Keyed by environment, never held on the plugin instance: a restart re-runs the
	// config file for `vite dev`, but an embedder that passes plugin objects in an
	// inline config hands the same objects (and the same ctx) to the replacement
	// server. Vite builds fresh environments either way, so this is what keeps one
	// server's shutdown from draining the session that replaced it.
	const sessions = new WeakMap<object, Session>()

	const drain = (session: Session) => {
		session.draining ??= (async () => {
			// registration order is plugin order, so the compiler goes before the
			// database connection it writes through
			for (const dispose of session.teardowns) {
				try {
					await dispose()
				} catch (err) {
					// one plugin failing to clean up must not strand the rest, but a
					// silent failure here reads as a successful shutdown
					console.error('[houdini] error shutting down:', err)
				}
			}
			// drop the closed compiler's child processes and sockets, which the session
			// would otherwise pin for as long as it lives
			session.teardowns.length = 0
			// the compiler closes ctx.db too, but a session that died before registering
			// never got that far
			try {
				ctx.db?.close()
			} catch {}
		})()
		return session.draining
	}

	return {
		name: 'houdini-close-session',

		configureServer(server) {
			// everything registered so far belongs to this server: every plugin that
			// registers does it from a configureServer that runs before this one
			const session: Session = { teardowns: ctx.teardowns.splice(0) }
			for (const environment of Object.values(server.environments)) {
				sessions.set(environment, session)
			}
			server.httpServer?.on('close', () => drain(session))
		},

		// No session means a production build, which must not tear down here. Vite
		// doesn't always await async buildStart hooks, so wait_for_plugin can still be
		// polling ctx.db when buildEnd fires, and closing it out from under that poll
		// ends in a 10-second registration timeout. The process exits shortly after a
		// build anyway.
		buildEnd(this: { environment?: object }) {
			const session = this.environment && sessions.get(this.environment)
			return session && drain(session)
		},
	} as PluginOption
}

async function load_vite_plugins(ctx: VitePluginContext): Promise<Array<PluginOption>> {
	return (
		await Promise.all(
			ctx.config.plugins.map(async (plugin) => {
				try {
					// try to import the plugin's vite subpath using ESM from project context
					// we need to resolve the module from the project's working directory
					let pluginModule: any

					try {
						// Local path plugins are codegen-only — they are never npm packages
						// and never provide a Vite subpath, so skip them silently.
						if (
							plugin.name.startsWith('./') ||
							plugin.name.startsWith('../') ||
							path.isAbsolute(plugin.name)
						) {
							return null
						}

						// use createRequire to resolve from the project's context
						// this is more resilient than manual path construction
						const projectRequire = createRequire(
							pathToFileURL(`${process.cwd()}/package.json`)
						)

						// first try to resolve the package.json to get the package directory
						const packageJsonPath = projectRequire.resolve(
							`${plugin.name}/package.json`
						)
						const packageDir = path.dirname(packageJsonPath)
						const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))

						// check if the package has a ./vite export
						if (!packageJson.exports?.['./vite']) {
							return null
						}

						// get the import path from the exports
						const viteExport = packageJson.exports['./vite']
						const viteImportPath =
							typeof viteExport === 'string' ? viteExport : viteExport.import

						if (!viteImportPath) {
							return null
						}

						// resolve the actual file path and import
						const viteFilePath = path.resolve(packageDir, viteImportPath)
						const viteFileUrl = pathToFileURL(viteFilePath).href

						pluginModule = await import(viteFileUrl)
					} catch (resolveError) {
						console.warn(
							'skipping plugin',
							plugin.name,
							'due to resolution error:',
							resolveError
						)
						// if resolution fails, skip this plugin
						return null
					}

					// handle both CommonJS and ESM export patterns
					// if the default export is an object with a nested default (CommonJS pattern),
					// extract the nested default
					let pluginFunction = pluginModule.default
					if (
						pluginFunction &&
						typeof pluginFunction === 'object' &&
						'default' in pluginFunction
					) {
						pluginFunction = pluginFunction.default
					}

					// check if we have a function to call
					if (typeof pluginFunction === 'function') {
						return pluginFunction(ctx)
					} else {
						throw new Error("Plugin's vite export is not a function")
					}
				} catch (_e) {
					// plugin doesn't have a vite subpath or failed to load, skip it
					return null
				}
			})
		)
	).filter(Boolean)
}
