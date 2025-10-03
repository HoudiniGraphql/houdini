import * as fs from 'node:fs'
import { createRequire } from 'node:module'
import * as path from 'node:path'
import type { DatabaseSync } from 'node:sqlite'
import { pathToFileURL } from 'node:url'
import type { PluginOption } from 'vite'

import { connect_db, get_config, type Adapter, type ConfigFile, type Config } from '../lib/index.js'
import { document_hmr } from './hmr.js'
import { houdini } from './houdini.js'
import { poll_remote_schema, watch_local_schema, refresh_on_schema } from './schema.js'

export type PluginConfig = { configPath?: string; adapter?: Adapter } & Partial<ConfigFile>

export type VitePluginContext = PluginConfig & { db: DatabaseSync; db_file: string; config: Config }

export default async function (opts?: PluginConfig): Promise<Array<PluginOption>> {
	// load the current config
	const config = await get_config()

	// and instantiate the database connection
	const [db, db_file] = connect_db(config)

	// build up the arguments we'll pass to the sub-plugins
	const ctx: VitePluginContext = {
		...opts,
		config,
		db_file,
		db,
	}

	return [
		houdini(ctx),
		document_hmr(ctx),
		poll_remote_schema(ctx),
		watch_local_schema(ctx),
		refresh_on_schema(ctx),
		// each registered plugin could provide a vite portion
		...(await load_vite_plugins(ctx)),
		close_db(ctx),
	]
}

function close_db(ctx: VitePluginContext) {
	return {
		name: 'houdini-close-database',
		configureServer(server) {
			server.httpServer?.on('close', () => {
				try {
					ctx.db.close()
				} catch {}
			})
		},
		buildEnd() {
			try {
				ctx.db.close()
			} catch {}
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
						// use createRequire to resolve from the project's context
						// this is more resilient than manual path construction
						const projectRequire = createRequire(
							pathToFileURL(process.cwd() + '/package.json')
						)

						// first try to resolve the package.json to get the package directory
						const packageJsonPath = projectRequire.resolve(
							`${plugin.name}/package.json`
						)
						const packageDir = path.dirname(packageJsonPath)
						const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))

						// check if the package has a ./vite export
						if (!packageJson.exports || !packageJson.exports['./vite']) {
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
				} catch (e) {
					// plugin doesn't have a vite subpath or failed to load, skip it
					return null
				}
			})
		)
	).filter(Boolean)
}
