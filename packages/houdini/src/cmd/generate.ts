import codegen from '../codegen'
import { Config, ConfigFile, formatErrors, getConfig } from '../lib'
import pullSchema from './pullSchema'

export async function generate(
	args: {
		pullSchema: boolean
		persistOutput?: string
		output?: string
		pullHeader?: string[]
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

	// load config
	config = await getConfig(extraConfig)
	if (args.output) {
		config.persistedQueryPath = args.output
	}
	// backwards compat
	if (args.persistOutput) {
		console.log('⚠️ --persist-output has been replaced by --output (abbreviated -o)')
		config.persistedQueryPath = args.persistOutput
	}

	try {
		// Pull the newest schema if the flag is set
		if (args.pullSchema && config.apiUrl) {
			// backwards compat
			if (args.pullHeader) {
				console.log('⚠️ --pull-headers has been replaced by --headers (abbreviated -h)')
				args.headers = args.pullHeader
			}

			await pullSchema(args)
		}

		await codegen(config)
	} catch (e) {
		// we need an array of errors to loop through
		const errors = (Array.isArray(e) ? e : [e]) as Error[]

		formatErrors(errors, function (error) {
			if (args.verbose && 'stack' in error && error.stack) {
				console.error(error.stack.split('\n').slice(1).join('\n'))
			}
		})
	}
}
