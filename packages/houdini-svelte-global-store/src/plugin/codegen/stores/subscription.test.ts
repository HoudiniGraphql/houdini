import { fs, CollectedGraphQLDocument, path } from 'houdini'
import { mockCollectedDoc } from 'houdini/test'
import * as recast from 'recast'
import * as typeScriptParser from 'recast/parsers/typescript'
import { test, expect } from 'vitest'

import runPipeline from '..'
import '../..'
import { test_config } from '../../../test'
import { stores_directory } from '../../kit'

test('generates a store for every subscription', async function () {
	const config = await test_config()
	const plugin_root = config.pluginDirectory('test-plugin')

	// the documents to test
	const docs: CollectedGraphQLDocument[] = [
		mockCollectedDoc(`subscription TestSubscription1 { newUser { id }  }`),
		mockCollectedDoc(`subscription TestSubscription2 { newUser { id }  }`),
	]

	// execute the generator
	await runPipeline({ config, documents: docs, plugin_root, framework: 'kit' })

	// look up the files in the artifact directory
	const files = await fs.readdir(stores_directory(plugin_root))

	// and they have the right names
	expect(files).toEqual(expect.arrayContaining(['TestSubscription1.js', 'TestSubscription2.js']))
	// and type definitions exist
	expect(files).toEqual(
		expect.arrayContaining(['TestSubscription1.d.ts', 'TestSubscription2.d.ts'])
	)

	const contents = await fs.readFile(
		path.join(stores_directory(plugin_root), 'TestSubscription1.js')
	)
	const parsed = recast.parse(contents!, {
		parser: typeScriptParser,
	}).program

	await expect(parsed).toMatchInlineSnapshot(
		`
		import artifact from '$houdini/artifacts/TestSubscription1'
		import { SubscriptionStore } from '$houdini/plugins/houdini-svelte/runtime/stores'

		export class TestSubscription1Store extends SubscriptionStore {
			constructor() {
				super({
					artifact,
				})
			}
		}

		export const GQL_TestSubscription1 = new TestSubscription1Store()

		export default GQL_TestSubscription1
	`
	)
})
