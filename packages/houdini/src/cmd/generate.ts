import { run_codegen } from '../lib/codegen'
import { start_server as start_config_server } from '../lib/configServer'
import { format_error } from '../lib/error'
import { get_config, type Config } from '../lib/project'
import pull_schema from './pullSchema'

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

		// we need an object that we'll as the env
		const env = {}

		// before we can start the codegen process we need to start the config server
		const [server, port] = await start_config_server(
			() => config!,
			() => env
		)

		// we can now run the codegen process
		await run_codegen(config, port)

		// we're done with the config server
		server.close()
	} catch (e) {
		format_error(e, function (error) {
			if (args.verbose && 'stack' in error && error.stack) {
				console.error(error.stack.split('\n').slice(1).join('\n'))
			}
		})

		process.exit(1)
	}
}
