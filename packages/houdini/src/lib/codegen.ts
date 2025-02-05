import { type ChildProcess, spawn } from 'child_process'
import sqlite from 'node:sqlite'

import * as fs from '../lib/fs'
import {
	type ConfigServer,
	type PluginSpec,
	start_server as start_config_server,
} from './configServer'
import { db_path } from './conventions'
import { create_schema } from './database'
import { type Config } from './project'

export type PluginMap = Record<string, PluginSpec & { process: ChildProcess }>

// pre_codegen sets up the codegen pipe before we start generating files. this primarily means starting
// the config server along with each plugin
export async function codegen_init(
	config: Config,
	env: Record<string, string>,
	mode: string
): Promise<{
	config_server: ConfigServer
	plugins: PluginMap
	database_path: string
}> {
	const plugins: PluginMap = {}

	// start the config server
	const config_server = await start_config_server(config, env)

	// we need to create a fresh database for orchestration
	const db_file = db_path(config)
	try {
		await fs.remove(db_file)
	} catch (e) {}
	const db = new sqlite.DatabaseSync(db_file)
	db.exec(create_schema)
	db.close()

	// start each plugin
	await Promise.all(
		config.plugins.map(async (plugin) => {
			plugins[plugin.name] = {
				// kick off the plugin process
				process: spawn(
					plugin.executable,
					['--config', `http://localhost:${config_server.port}`, '--database', db_file],
					{
						stdio: 'inherit',
					}
				),
				// and wait for the plugin to report back its port
				...(await config_server.wait_for_plugin(plugin.name)),
			}
		})
	)

	// load the environment variables from our plugins as assign the values onto the object we gave
	// the config server
	Object.assign(env, await config_server.load_env(mode))

	// TODO: config hook

	// now that we've loaded the environment, we need to invoke the afterLoad hook
	await config_server.trigger_hook('AfterLoad')

	return {
		database_path: db_file,
		config_server: {
			...config_server,
			// to cleanup, we need to send a sigterm to each plugin and kill the config server,
			close: () => {
				// stop each plugin
				for (const [, { process }] of Object.entries(plugins)) {
					process.kill('SIGTERM')
				}

				// stop the config server
				config_server.close()
			},
		},
		plugins,
	}
}

export async function codegen(config: Config, plugin_ports: Record<string, number>) {}
