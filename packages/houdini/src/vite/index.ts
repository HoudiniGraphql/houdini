import type { DatabaseSync } from 'node:sqlite'
import type { PluginOption } from 'vite'

import { connect_db, get_config, type Adapter, type ConfigFile } from '../lib'
import { document_hmr } from './hmr'
import { houdini } from './houdini'
import { poll_remote_schema, watch_local_schema, refresh_on_schema } from './schema'

export type PluginConfig = { configPath?: string; adapter?: Adapter } & Partial<ConfigFile>

export type PluginContext = PluginConfig & { db: DatabaseSync; db_file: string }

export default async function (opts?: PluginConfig): Promise<Array<PluginOption>> {
	// load the current config
	const config = await get_config()

	// and instantiate the database connection
	const [db, db_file] = connect_db(config)

	// build up the arguments we'll pass to the sub-plugins
	const ctx: PluginContext = {
		...opts,
		db_file,
		db,
	}

	// each registered plugin could provide a vite portion
	let pluginPlugins: Array<PluginOption> = []

	return [
		houdini(ctx),
		document_hmr(ctx),
		poll_remote_schema(ctx),
		watch_local_schema(ctx),
		refresh_on_schema(ctx),
		...pluginPlugins,
		close_db(ctx),
	]
}

function close_db(ctx: PluginContext) {
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
