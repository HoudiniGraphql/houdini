import { Command } from 'commander'
import { yellow } from 'kleur/colors'
import type { HoudiniError } from '../lib/error.js'
import { generate } from './generate.js'
import pullSchema from './pullSchema.js'

// build up the cli
const program = new Command()

// register the generate command
program
	.command('generate')
	.description('generate the application runtime')
	.option('-p, --pull-schema', 'pull the latest schema before generating')
	.option('-r, --preserve-database', 'preserve any existing generated logic')
	.option('-o, --output [outputPath]', 'persist queries to a queryMap file')
	.option(
		'-h, --headers <headers...>',
		'headers to use when pulling your schema. Should be passed as KEY=VALUE'
	)
	.option('-v, --verbose', 'verbose error messages')
	.option(
		'--after-phase <phase>',
		'start the pipeline after the specified phase (Config, AfterLoad, Schema, ExtractDocuments, AfterExtract, BeforeValidate, Validate, AfterValidate, BeforeGenerate, GenerateDocuments, GenerateRuntime, AfterGenerate)'
	)
	.option(
		'--before-phase <phase>',
		'run the pipeline up to and including the specified phase (Config, AfterLoad, Schema, ExtractDocuments, AfterExtract, BeforeValidate, Validate, AfterValidate, BeforeGenerate, GenerateDocuments, GenerateRuntime, AfterGenerate)'
	)
	.action(generate)

// register the init command
program
	.command('init')
	.description('REMOVED: use the svelte cli community addon instead')
	.action(() => {
		console.log(
			`${yellow('The init command has been replaced by a community addon for the Svelte CLI.')}`
		)
		console.log(
			`${yellow('To get started, run `npx sv add @houdinigraphql` in a SvelteKit project.')}`
		)
	})

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
