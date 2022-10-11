import { Command } from 'commander'

import generate from '../codegen'
import { formatErrors, getConfig, LogLevel, Config } from '../lib'
import { ConfigFile } from '../runtime/lib/config'
import init from './init'
import pullSchema from './pullSchema'

// build up the cli
const program = new Command()

// register the generate command
program
	.command('generate')
	.description('generate the application runtime')
	.option('-p, --pull-schema', 'pull the latest schema before generating')
	.option('-o, --output [outputPath]', 'persist queries to a queryMap file')
	.option(
		'-po, --persist-output [outputPath]',
		'deprecated in favor of --output. persist queries to a queryMap file'
	)
	.option(
		'-ph, --pull-headers <headers...>',
		'deprecated in favor of --headers. headers to use when pulling your schema. Should be passed as KEY=VALUE'
	)
	.option(
		'-h, --headers <headers...>',
		'headers to use when pulling your schema. Should be passed as KEY=VALUE'
	)
	.option('-v, --verbose', 'verbose error messages')
	.option(
		'-l, --log [level]',
		`the log level for the generate command. One of ${JSON.stringify(Object.values(LogLevel))}`
	)
	.action(
		async (
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
		) => {
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
						console.log(
							'⚠️ --pull-headers has been replaced by --headers (abbreviated -h)'
						)
						args.headers = args.pullHeader
					}

					await pullSchema(args)
				}

				await generate(config)
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
	)

// register the init command
program
	.command('init')
	.arguments('[path]')
	.usage('[path] [options]')
	.description('initialize a new houdini project')
	.option(
		'-h, --headers <headers...>',
		'header to use when pulling your schema. Should be passed as KEY=VALUE'
	)
	.action(init)

// register the pull schema command
program
	.command('pull-schema')
	.usage('[options]')
	.description('pull the latest schema from your api')
	.option(
		'-h, --headers <headers...>',
		'headers to use when pulling your schema. Should be passed as KEY=VALUE'
	)
	.action(pullSchema)

// start the command
program.parse()
