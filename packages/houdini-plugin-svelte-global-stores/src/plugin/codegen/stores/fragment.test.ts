import { fs, path } from 'houdini'
import * as recast from 'recast'
import * as typeScriptParser from 'recast/parsers/typescript'
import { expect, test } from 'vitest'

import { pipeline_test } from '../../../test'
import { global_stores_directory } from '../../kit'

test('global fragment', async function () {
	const docs = [`fragment TestFragment1 on User { id }`, `fragment TestFragment2 on User { id }`]

	const { pluginRoot } = await pipeline_test(docs)

	// look up the files in the artifact directory
	const files = await fs.readdir(global_stores_directory(pluginRoot))

	// and they have the right names
	expect(files).toEqual(expect.arrayContaining(['TestFragment1.js', 'TestFragment2.js']))

	const contents = await fs.readFile(
		path.join(global_stores_directory(pluginRoot), 'TestFragment1.js')
	)
	const parsed = recast.parse(contents!, {
		parser: typeScriptParser,
	}).program

	expect(parsed).toMatchInlineSnapshot(
		`
		import { TestFragment1Store } from '../../houdini-svelte/stores'

		export const GQL_TestFragment1 = new TestFragment1Store()
	`
	)
})

test('global fragment type', async function () {
	const docs = [`fragment TestFragment1 on User { id }`, `fragment TestFragment2 on User { id }`]

	const { pluginRoot } = await pipeline_test(docs)

	// look up the files in the artifact directory
	const files = await fs.readdir(global_stores_directory(pluginRoot))

	// and type definitions exist
	expect(files).toEqual(expect.arrayContaining(['TestFragment1.d.ts', 'TestFragment2.d.ts']))

	const contents = await fs.readFile(
		path.join(global_stores_directory(pluginRoot), 'TestFragment1.d.ts')
	)

	expect(contents).toMatchInlineSnapshot(
		`
		"import { TestFragment1Store } from '../../houdini-svelte/stores'

		export const GQL_TestFragment1: TestFragment1Store"
	`
	)
})

test('no fragment', async function () {
	const docs = [`fragment TestFragment1 on User { id }`, `fragment TestFragment2 on User { id }`]

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
		path.join(global_stores_directory(pluginRoot), 'TestFragment1.js')
	)

	// parse the contents
	const parsed = recast.parse(contents!, {
		parser: typeScriptParser,
	}).program

	// check the file contents
	expect(parsed).toMatchInlineSnapshot('null')
})
