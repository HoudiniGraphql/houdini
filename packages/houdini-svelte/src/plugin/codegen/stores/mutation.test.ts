import type { Document } from 'houdini'
import { fs, path, recast } from 'houdini'
import { mockCollectedDoc } from 'houdini/test'
import * as typeScriptParser from 'recast/parsers/typescript'
import { test, expect } from 'vitest'

import runPipeline from '..'
import '../..'
import { test_config } from '../../../test'
import { stores_directory } from '../../kit'

test('generates a store for every mutation', async function () {
	const config = await test_config()
	const pluginRoot = config.pluginDirectory('test-plugin')

	// the documents to test
	const docs: Document[] = [
		mockCollectedDoc(`mutation TestMutation1 { updateUser { id }  }`),
		mockCollectedDoc(`mutation TestMutation2 { updateUser { id }  }`),
	]

	// execute the generator
	await runPipeline({ config, documents: docs, pluginRoot, framework: 'kit' })

	// look up the files in the artifact directory
	const files = await fs.readdir(stores_directory(pluginRoot))

	// and they have the right names
	expect(files).toEqual(expect.arrayContaining(['TestMutation1.js', 'TestMutation2.js']))
	// and type definitions exist
	expect(files).toEqual(expect.arrayContaining(['TestMutation1.d.ts', 'TestMutation2.d.ts']))

	const contents = await fs.readFile(path.join(stores_directory(pluginRoot), 'TestMutation1.js'))
	const parsed = recast.parse(contents!, {
		parser: typeScriptParser,
	}).program

	await expect(parsed).toMatchInlineSnapshot(
		`
		import artifact from '$houdini/artifacts/TestMutation1'
		import { MutationStore } from '../runtime/stores/mutation'

		export class TestMutation1Store extends MutationStore {
			constructor() {
				super({
					artifact,
				})
			}
		}
	`
	)
})
