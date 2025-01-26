import type { ProgramKind } from 'ast-types/lib/gen/kinds'
import * as recast from 'recast'
import * as typeScriptParser from 'recast/parsers/typescript'
import { test, expect } from 'vitest'

import { runPipeline } from '../..'
import { fs, path } from '../../../lib'
import { testConfig } from '../../../test'

test('generates hooks to modify the config file at runtime', async function () {
	const config = testConfig({
		module: 'esm',
	})
	config.plugins = [
		{
			name: 'pluginWithClientPlugin',
			filepath: '',
			config: 'module1',
		},
	]

	// execute the generator
	await runPipeline(config, [])

	// open up the index file
	const fileContents = await fs.readFile(
		path.join(config.runtimeDirectory, 'imports', 'pluginConfig.js')
	)
	expect(fileContents).toBeTruthy()

	// parse the contents
	const parsedQuery: ProgramKind = recast.parse(fileContents!, {
		parser: typeScriptParser,
	}).program
	// verify contents
	expect(parsedQuery).toMatchInlineSnapshot(`
		import plugin0 from 'module1'

		const plugins = [
			plugin0
		]

		export default plugins
	`)
})
