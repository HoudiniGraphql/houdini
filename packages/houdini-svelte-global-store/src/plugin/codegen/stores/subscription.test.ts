import { CollectedGraphQLDocument, fs, path } from 'houdini'
import { mockCollectedDoc } from 'houdini/test'
import * as recast from 'recast'
import * as typeScriptParser from 'recast/parsers/typescript'
import { expect, test } from 'vitest'

import runPipeline from '..'
import { test_config } from '../../../test'
import { global_stores_directory } from '../../kit'

test('generates a store for every subscription', async function () {
	const config = await test_config()
	const plugin_root = config.pluginDirectory('test-plugin')

	// the documents to test
	const docs: CollectedGraphQLDocument[] = [
		mockCollectedDoc(`subscription TestSubscription1 { newUser { id }  }`),
		mockCollectedDoc(`subscription TestSubscription2 { newUser { id }  }`),
	]

	// execute the generator
	await runPipeline({ config, documents: docs, plugin_root })

	// look up the files in the artifact directory
	const files = await fs.readdir(global_stores_directory(plugin_root))

	// and they have the right names
	expect(files).toEqual(expect.arrayContaining(['TestSubscription1.js', 'TestSubscription2.js']))
	// and type definitions exist
	expect(files).toEqual(
		expect.arrayContaining(['TestSubscription1.d.ts', 'TestSubscription2.d.ts'])
	)

	const contents = await fs.readFile(
		path.join(global_stores_directory(plugin_root), 'TestSubscription1.js')
	)
	const parsed = recast.parse(contents!, {
		parser: typeScriptParser,
	}).program

	expect(parsed).toMatchInlineSnapshot(
		`
		import { TestSubscription1Store } from '../../houdini-svelte/stores'

		export const GQL_TestSubscription1 = new TestSubscription1Store()
	`
	)
})
