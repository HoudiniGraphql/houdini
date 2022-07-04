// external imports
import { Command } from 'commander'
import { glob } from 'glob'
import path from 'path'
import util from 'util'
// local imports
import { getConfig, LogLevel, readConfigFile } from '../common'
import { ConfigFile } from '../runtime'
import generate from './generate'
import init from './init'
import { HoudiniError } from './types'
import { writeSchema } from './utils/writeSchema'

// build up the cli
const program = new Command()

// register the generate command
program
	.command('generate')
	.description('generate the application runtime')
	.option('-p, --pull-schema', 'pull the latest schema before generating')
	.option('-po, --persist-output [outputPath]', 'persist queries to a queryMap file')
	.option('-v, --verbose', 'verbose error messages')
	.option(
		'-ph, --pull-header <headers...>',
		'header to use when pulling your schema. Should be passed as KEY=VALUE'
	)
	.option(
		'-l, --log [level]',
		`the log level for the generate command. One of ${JSON.stringify(Object.values(LogLevel))}`
	)
	.action(
		async (
			args: {
				pullSchema: boolean
				persistOutput?: string
				pullHeader: string[]
				log?: string
				verbose: boolean
			} = {
				pullSchema: false,
				pullHeader: [],
				verbose: false,
			}
		) => {
			// grab the config file
			let config

			// build up extra config values from command line arguments
			const extraConfig: Partial<ConfigFile> = {}
			if (args.log) {
				extraConfig.logLevel = args.log
			}

			try {
				// Pull the newest schema if the flag is set
				if (args.pullSchema) {
					config = await readConfigFile()
					// Check if apiUrl is set in config
					if (!config.apiUrl) {
						throw new Error(
							'❌ Your config should contain a valid apiUrl to pull the latest schema.'
						)
					}

					// if the schema path is a glob, tell the user this flag doesn't do anything
					if (config.schemaPath && glob.hasMagic(config.schemaPath)) {
						console.warn(
							'⚠️ --pull-schema is not supported when the schemaPath is a glob. Remember, if your ' +
								"schema is already available locally you don't need this flag."
						)
					}
					// the schema path isn't a glob
					else {
						// The target path -> current working directory by default. Should we allow passing custom paths?
						const targetPath = process.cwd()
						// Write the schema
						await writeSchema(
							config.apiUrl,
							config.schemaPath
								? config.schemaPath
								: path.resolve(targetPath, 'schema.json'),
							args.pullHeader
						)
						console.log(`✅ Pulled latest schema from ${config.apiUrl}`)
					}
				}

				// Load config
				config = await getConfig(extraConfig)
				if (args.persistOutput) {
					config.persistedQueryPath = args.persistOutput
				}

				await generate(config)
			} catch (e) {
				// we need an array of errors to loop through
				const errors = (Array.isArray(e) ? e : [e]) as HoudiniError[]

				for (const error of errors) {
					// if we have filepath, show that to the user
					if ('filepath' in error) {
						console.error(`❌ Encountered error in ${error.filepath}`)
						console.error(error.message)
					} else {
						console.error(`❌ ${error.message}`)
						if ('description' in error) {
							console.error(`${error.description}`)
						}
					}
					if (args.verbose && 'stack' in error && error.stack) {
						console.error(error.stack.split('\n').slice(1).join('\n'))
					}
				}
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
		'-ph, --pull-header <headers...>',
		'header to use when pulling your schema. Should be passed as KEY=VALUE'
	)
	.action(init)

// start the command
program.parse()
