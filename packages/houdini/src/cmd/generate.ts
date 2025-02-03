import { pre_codegen } from 'src/lib'

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
	} = {
		pullSchema: false,
		headers: [],
		verbose: false,
	}
) {
	try {
		// grab the config file
		let config: Config | null = await get_config()

		// we need an object that we'll use as the env
		const env = {}

		// initialize the codegen pipe
		const { ports, stop } = await pre_codegen(config, env)

		console.log(ports)

		// we're done, close everything
		stop()
	} catch (e) {
		format_error(e, function (error) {
			if (args.verbose && 'stack' in error && error.stack) {
				console.error(error.stack.split('\n').slice(1).join('\n'))
			}
		})

		process.exit(1)
	}
}
