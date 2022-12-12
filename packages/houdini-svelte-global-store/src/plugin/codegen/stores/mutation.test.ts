import { fs, CollectedGraphQLDocument, path } from 'houdini'
import { mockCollectedDoc } from 'houdini/test'
import * as recast from 'recast'
import * as typeScriptParser from 'recast/parsers/typescript'
import { test, expect } from 'vitest'

import runPipeline from '..'
import '../..'
import { test_config } from '../../../test'
import { global_stores_directory } from '../../kit'

test('generates a store for every mutation', async function () {
	const config = await test_config()
	const plugin_root = config.pluginDirectory('test-plugin')

	// the documents to test
	const docs: CollectedGraphQLDocument[] = [
		mockCollectedDoc(`mutation TestMutation1 { updateUser { id }  }`),
		mockCollectedDoc(`mutation TestMutation2 { updateUser { id }  }`),
	]

	// execute the generator
	await runPipeline({ config, documents: docs, plugin_root })

	// look up the files in the artifact directory
	const files = await fs.readdir(global_stores_directory(plugin_root))

	// and they have the right names
	expect(files).toEqual(expect.arrayContaining(['TestMutation1.js', 'TestMutation2.js']))
	// and type definitions exist
	expect(files).toEqual(expect.arrayContaining(['TestMutation1.d.ts', 'TestMutation2.d.ts']))

	const contents = await fs.readFile(
		path.join(global_stores_directory(plugin_root), 'TestMutation1.js')
	)
	const parsed = recast.parse(contents!, {
		parser: typeScriptParser,
	}).program

	await expect(parsed).toMatchInlineSnapshot(
		`
		// import...

		export const GQL_TestMutation1 = new TestMutation1Store()
	`
	)
})
