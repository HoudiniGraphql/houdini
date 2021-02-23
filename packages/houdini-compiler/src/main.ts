#!/usr/bin/env node

// external imports
import { getConfig } from 'houdini-common'
import { Command } from 'commander'
// local imports
import compile from './compile'

// build up the cli
const program = new Command()

// register the generate command
program.command('generate')
	.description('generate the application runtime')
	.action(async () => {
		// grab the config file
		const config = await getConfig()

		await compile(config)
	})

// start the command
program.parse()
