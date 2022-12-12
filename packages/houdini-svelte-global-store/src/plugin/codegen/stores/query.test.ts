import { fs, CollectedGraphQLDocument, path } from 'houdini'
import { mockCollectedDoc } from 'houdini/test'
import * as recast from 'recast'
import * as typeScriptParser from 'recast/parsers/typescript'
import { expect, test } from 'vitest'

import runPipeline from '..'
import '../..'
import '../..'
import { pipeline_test } from '../../../test'
import { test_config } from '../../../test'
import { global_stores_directory } from '../../kit'

test('change globalStorePrefix to "yop___"', async function () {
	const docs = [`query TestQuery { version }`]

	const { plugin_root } = await pipeline_test(docs, {
		plugins: {
			'houdini-svelte': {},
			'houdini-svelte-global-store': {
				globalStorePrefix: 'yop___',
			},
		},
	})

	const contents = await fs.readFile(
		path.join(global_stores_directory(plugin_root), 'TestQuery.js')
	)

	// parse the contents
	const parsed = recast.parse(contents!, {
		parser: typeScriptParser,
	}).program

	// check the file contents
	await expect(parsed).toMatchInlineSnapshot(`
		// import 

		export const yop___TestQuery = new TestQueryStore()
	`)
})

test('change globalStorePrefix to ""', async function () {
	const docs = [`query TestQuery { version }`]

	const { plugin_root } = await pipeline_test(docs, {
		plugins: {
			'houdini-svelte': {},
			'houdini-svelte-global-store': {
				globalStorePrefix: '',
			},
		},
	})

	const contents = await fs.readFile(
		path.join(global_stores_directory(plugin_root), 'TestQuery.js')
	)

	// parse the contents
	const parsed = recast.parse(contents!, {
		parser: typeScriptParser,
	}).program

	// check the file contents
	await expect(parsed).toMatchInlineSnapshot(`
		// import 

		export const TestQuery = new TestQueryStore()
	`)
})
