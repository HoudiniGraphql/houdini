import { Command } from 'commander'
import { glob } from 'glob'
import path from 'path'

import { getConfig, LogLevel, readConfigFile } from '../common/config'
import { formatErrors } from '../common/graphql'
import type { ConfigFile } from '../runtime/lib/config'
import generate from './generate'
import init from './init'
import type { HoudiniError } from './types'
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

						let headers = {}
						if ((args.pullHeader ?? []).length > 0) {
							headers = args.pullHeader.reduce((total, header) => {
								const [key, value] = header.split('=')
								return {
									...total,
									[key]: value,
								}
							}, {})
						}

						// Write the schema
						await writeSchema(
							config.apiUrl,
							config.schemaPath
								? config.schemaPath
								: path.resolve(targetPath, 'schema.json'),
							headers
						)
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
		'-ph, --pull-header <headers...>',
		'header to use when pulling your schema. Should be passed as KEY=VALUE'
	)
	.option('-y, --yes', 'initialize a project with the default values (compatible with SvelteKit)')
	.action(init)

// start the command
program.parse()
