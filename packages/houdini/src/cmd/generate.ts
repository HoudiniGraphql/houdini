import { formatErrors, getConfig, loadLocalSchema } from '../lib'
import type { Config, ConfigFile } from '../lib'
import { startServer } from '../lib/configServer'
import pullSchema from './pullSchema'

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
	// grab the config file
	let config: Config | null = null

	// build up extra config values from command line arguments
	const extraConfig: Partial<ConfigFile> = {}
	if (args.log) {
		extraConfig.logLevel = args.log
	}

	try {
		// load config
		config = await getConfig(extraConfig)
		if (args.output) {
			config.persistedQueriesPath = args.output
		}

		// if we have a local schema then we need to load it
		if (config.localSchema) {
			config.schema = await loadLocalSchema(config)
		}

		// Pull the newest schema if the flag is set
		else if (args.pullSchema && (await config.apiURL())) {
			await pullSchema(args)
		}

		// before we can start the codegen process we need to start the config server
		startServer(() => config!)
	} catch (e) {
		formatErrors(e, function (error) {
			if (args.verbose && 'stack' in error && error.stack) {
				console.error(error.stack.split('\n').slice(1).join('\n'))
			}
		})

		process.exit(1)
	}
}
