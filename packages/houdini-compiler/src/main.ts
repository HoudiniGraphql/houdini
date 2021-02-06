#! /usr/bin/env node

// externals
import { getConfig } from 'houdini-common'
// locals
import compile from './compile'

async function main() {
	// invoke the compiler
	await compile(await getConfig())
}

// run the main entry point and if there is an error
main().catch((err) => {
	console.log(err)
	// return with a status code 1
	process.exit(1)
})
