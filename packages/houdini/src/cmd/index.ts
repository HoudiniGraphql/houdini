import { Command } from 'commander'

import type { HoudiniError } from '../../legacy/lib'
import { generate } from './generate'
import { init } from './init'
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
		'-h, --headers <headers...>',
		'headers to use when pulling your schema. Should be passed as KEY=VALUE'
	)
	.option('-v, --verbose', 'verbose error messages')
	.action(generate)

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
	.option('-y, --yes', 'dont prompt for input. uses default values or empty strings')
	.action(init)

// register the pull schema command
program
	.command('pull-schema')
	.usage('[options]')
	.description('pull the latest schema from your api')
	.option('-o, --output [outputPath]', 'the destination for the schema contents')
	.option(
		'-h, --headers <headers...>',
		'headers to use when pulling your schema. Should be passed as KEY=VALUE'
	)
	.action(pullSchema)

// start the command
program.parse()

// silence unhandled houdini errors
process.on('unhandledRejection', (error: HoudiniError) => {
	if ('description' in error) {
	} else {
		console.log(error)
	}
})
