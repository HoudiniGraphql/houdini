import type { ProgramKind } from 'ast-types/lib/gen/kinds'
import * as recast from 'recast'
import * as typeScriptParser from 'recast/parsers/typescript'
import { test, expect } from 'vitest'

import { runPipeline } from '../..'
import { fs, path } from '../../../../lib'
import { testConfig } from '../../../test'

test('generates an index file for the plugin directory', async function () {
	const config = testConfig()
	config.plugins = [
		{
			name: 'pluginWithClientPlugin',
			filepath: '',
			clientPlugins: {
				testPlugin: {},
			},
		},
	]

	// execute the generator
	await runPipeline(config, [])

	// open up the index file
	const fileContents = await fs.readFile(path.join(config.pluginRootDirectory, 'index.js'))
	expect(fileContents).toBeTruthy()

	// parse the contents
	const parsedFile: ProgramKind = recast.parse(fileContents!, {
		parser: typeScriptParser,
	}).program
	// verify contents
	expect(parsedFile).toMatchInlineSnapshot("export * from '../runtime/client/plugins/index.js'")

	// open up the index file
	const typedefContents = await fs.readFile(path.join(config.pluginRootDirectory, 'index.js'))
	expect(typedefContents).toBeTruthy()

	// parse the contents
	const parsedTypedef: ProgramKind = recast.parse(typedefContents!, {
		parser: typeScriptParser,
	}).program
	// verify contents
	expect(parsedTypedef).toMatchInlineSnapshot(
		"export * from '../runtime/client/plugins/index.js'"
	)
})
