import { type ChildProcess, spawn } from 'child_process'

import { start_server as start_config_server } from './configServer'
import { Config } from './project'

// pre_codegen sets up the codegen pipe before we start generating files. this primarily means starting
// the config server along with each plugin
export async function pre_codegen(
	config: Config,
	env: Record<string, string>
): Promise<{
	ports: Record<string, number>
	stop: () => void
}> {
	const plugins: Record<string, { port: number; process: ChildProcess }> = {}

	// start the config server
	const config_server = await start_config_server(config, env)

	// start each plugin
	for (const plugin of config.plugins) {
		const child = spawn(
			plugin.executable,
			['--config', `http://localhost:${config_server.port.toString()}`],
			{
				stdio: 'inherit',
			}
		)

		// now we need to wait for the plugin to report back its port
		const port = await config_server.wait_for_plugin(plugin.name)

		plugins[plugin.name] = { port, process: child }
	}

	// to stop each process we need to kill the config server and send a sigterm to each plugin
	const stop = () => {
		// stop each plugin
		for (const { process } of Object.values(plugins)) {
			process.kill('SIGTERM')
		}

		// stop the config server
		config_server.close()
	}

	return {
		ports: Object.fromEntries(Object.entries(plugins).map(([key, value]) => [key, value.port])),
		stop,
	}
}

export async function codegen(config: Config, plugin_ports: Record<string, number>) {}
