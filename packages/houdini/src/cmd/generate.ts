import codegen from '../codegen'
import type { Config, ConfigFile } from '../lib'
import { formatErrors, getConfig } from '../lib'
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
			config.internalPersistedQueriesPath = args.output
		}

		// Pull the newest schema if the flag is set
		if (args.pullSchema && (await config.apiURL())) {
			await pullSchema(args)
		}

		await codegen(config)
	} catch (e) {
		formatErrors(e, function (error) {
			if (args.verbose && 'stack' in error && error.stack) {
				console.error(error.stack.split('\n').slice(1).join('\n'))
			}
		})
	}
}
