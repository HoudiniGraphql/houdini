#!/usr/bin/env node

// external imports
import { getConfig } from 'houdini-common'
import { Command } from 'commander'
// local imports
import compile from './compile'
import init from './init'

// build up the cli
const program = new Command()

// register the generate command
program
	.command('generate')
	.description('generate the application runtime')
	.action(async () => {
		// grab the config file
		const config = await getConfig()

		try {
			await compile(config)
		} catch (e) {
			console.error(e)
		}
	})

// register the init command
program.command('init [path]').description('initialize a new houdini project').action(init)

// start the command
program.parse()
