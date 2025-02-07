import { codegen, codegen_init } from 'src/lib'
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
	// make sure there is always a mode
	const mode = args.mode ?? 'development'

	let config_server: any | null = null

	// Function to handle graceful shutdown
	const handleShutdown = async () => {
		try {
			if (config_server) {
				config_server.close()
			}
			process.exit(0)
		} catch (error) {
			process.exit(1)
		}
	}

	// Set up signal handlers
	process.on('SIGINT', handleShutdown)
	process.on('SIGTERM', handleShutdown)

	try {
		// grab the config file
		let config: Config | null = await get_config()

		// we need an object that we'll use as the env
		const env = {}

		// initialize the codegen pipe
		const result = await codegen_init(config, env, mode)
		config_server = result.config_server

		// kick off the codegen pipeline
		await codegen(config_server)

		// we're done, close everything
		config_server.close()
		process.exit(0)
	} catch (e) {
		format_error(e, function (error) {
			if (args.verbose && 'stack' in error && error.stack) {
				console.error(error.stack?.split('\n').slice(1).join('\n'))
			}
		})

		// Attempt to close config_server if it exists
		try {
			if (config_server) {
				config_server.close()
			}
		} catch (closeError) {
			console.error('Error closing config_server:', closeError)
		}

		process.exit(1)
	}
}
