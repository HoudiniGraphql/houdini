import { fs, path } from 'houdini'
import * as recast from 'recast'
import * as typeScriptParser from 'recast/parsers/typescript'
import { expect, test } from 'vitest'

import { pipeline_test } from '../../../test'
import { global_stores_directory } from '../../kit'

test('generates a store for every mutation', async function () {
	const docs = [
		`mutation TestMutation1 { updateUser { id }  }`,
		`mutation TestMutation2 { updateUser { id }  }`,
	]

	const { pluginRoot } = await pipeline_test(docs)

	// look up the files in the artifact directory
	const files = await fs.readdir(global_stores_directory(pluginRoot))

	// and they have the right names
	expect(files).toEqual(expect.arrayContaining(['TestMutation1.js', 'TestMutation2.js']))
	// and type definitions exist
	expect(files).toEqual(expect.arrayContaining(['TestMutation1.d.ts', 'TestMutation2.d.ts']))

	const contents = await fs.readFile(
		path.join(global_stores_directory(pluginRoot), 'TestMutation1.js')
	)
	const parsed = recast.parse(contents!, {
		parser: typeScriptParser,
	}).program

	expect(parsed).toMatchInlineSnapshot(
		`
		import { TestMutation1Store } from '../../houdini-svelte/stores'

		export const GQL_TestMutation1 = new TestMutation1Store()
	`
	)
})

test('no mutation', async function () {
	const docs = [
		`mutation TestMutation1 { updateUser { id }  }`,
		`mutation TestMutation2 { updateUser { id }  }`,
	]

	const { pluginRoot } = await pipeline_test(docs, {
		plugins: {
			'houdini-svelte': {},
			'houdini-plugin-svelte-global-stores': {
				prefix: '',
				generate: [],
			},
		},
	})

	const contents = await fs.readFile(
		path.join(global_stores_directory(pluginRoot), 'TestMutation1.js')
	)

	// parse the contents
	const parsed = recast.parse(contents!, {
		parser: typeScriptParser,
	}).program

	// check the file contents
	expect(parsed).toMatchInlineSnapshot('null')
})
