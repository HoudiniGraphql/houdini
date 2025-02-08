import { codegen, codegen_init } from 'src/lib'

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

	// until we've initialized the pipeline, there's nothing to do on close
	let on_close = () => {}

	try {
		// grab the config file
		let config: Config | null = await get_config()

		// initialize the codegen pipe
		const { trigger_hook, close } = await codegen_init(config, mode)

		// Function to handle graceful shutdown
		on_close = async () => {
			try {
				close()
				process.exit(0)
			} catch (error) {
				process.exit(1)
			}
		}

		// Set up signal handlers
		process.on('SIGINT', on_close)
		process.on('SIGTERM', on_close)

		// kick off the codegen pipeline
		await codegen(trigger_hook)

		// we're done, close everything
		on_close()
	} catch (e) {
		// if something goes wrong, format the error
		format_error(e, function (error) {
			console.error(error.stack?.split('\n').slice(1).join('\n'))
		})

		// attempt to close any plugins
		try {
			on_close()
		} catch (closeError) {
			console.error('Error closing plugins:', closeError)
		}

		process.exit(1)
	}
}
