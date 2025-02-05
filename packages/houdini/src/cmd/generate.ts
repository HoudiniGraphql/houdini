import { codegen_init } from 'src/lib'
import { sleep } from 'src/lib/sleep'

import { format_error } from '../lib/error'
import { get_config, type Config } from '../lib/project'

export async function generate(
	args: {
		pullSchema: boolean
		persistOutput?: string
		output?: string
		headers: string[]
		log?: string
		verbose: boolean
		mode?: string
	} = {
		pullSchema: false,
		headers: [],
		verbose: false,
	}
) {
	// make sur ethere is always a mode
	if (!args.mode) {
		args.mode = 'development'
	}

	try {
		// grab the config file
		let config: Config | null = await get_config()

		// we need an object that we'll use as the env
		const env = {}

		// initialize the codegen pipe
		const { config_server, stop, plugins } = await codegen_init(config, env)

		console.log(plugins)

		// load the environment variables from our plugins as assign the values onto the object we gave
		// the config server
		Object.assign(env, await config_server.load_env(args.mode!))

		// TODO: config hook
		console.log(env)

		// now that we've loaded the environment, we need to invoke the afterLoad hook
		await config_server.trigger_hook('AfterLoad')

		// we're done, close everything
		stop()

		process.exit(0)
	} catch (e) {
		format_error(e, function (error) {
			if (args.verbose && 'stack' in error && error.stack) {
				console.error(error.stack.split('\n').slice(1).join('\n'))
			}
		})

		process.exit(1)
	}
}
