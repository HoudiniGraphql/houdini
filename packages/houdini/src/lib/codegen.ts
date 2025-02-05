import { type ChildProcess, spawn } from 'child_process'
import sqlite from 'node:sqlite'

import * as fs from '../lib/fs'
import {
	type ConfigServer,
	type PluginSpec,
	start_server as start_config_server,
} from './configServer'
import { db_path } from './conventions'
import { type Config } from './project'

export type PluginMap = Record<string, PluginSpec & { process: ChildProcess }>

// pre_codegen sets up the codegen pipe before we start generating files. this primarily means starting
// the config server along with each plugin
export async function codegen_init(
	config: Config,
	env: Record<string, string>
): Promise<{
	config_server: ConfigServer
	plugins: PluginMap
	database_path: string
	stop: () => void
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

	// to cleanup, we need to send a sigterm to each plugin and kill the config server
	const stop = () => {
		// stop each plugin
		for (const [, { process }] of Object.entries(plugins)) {
			process.kill('SIGTERM')
		}

		// stop the config server
		config_server.close()
	}

	return {
		database_path: db_file,
		config_server,
		plugins,
		stop,
	}
}

export async function codegen(config: Config, plugin_ports: Record<string, number>) {}
