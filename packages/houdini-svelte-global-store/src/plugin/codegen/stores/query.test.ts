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
		import { QueryStore } from '$houdini/plugins/houdini-svelte/runtime/stores'
		import artifact from '$houdini/artifacts/TestQuery'

		export class TestQueryStore extends QueryStore {
			constructor() {
				super({
					artifact,
					storeName: "TestQueryStore",
					variables: false,
				})
			}
		}

		export async function load_TestQuery(params) {
			const store = new TestQueryStore()

			await store.fetch(params)

			return {
				TestQuery: store,
			}
		}

		export default new TestQueryStore()
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
		import { QueryStore } from '$houdini/plugins/houdini-svelte/runtime/stores'
		import artifact from '$houdini/artifacts/TestQuery'

		export class TestQueryStore extends QueryStore {
			constructor() {
				super({
					artifact,
					storeName: "TestQueryStore",
					variables: false,
				})
			}
		}

		export async function load_TestQuery(params) {
			const store = new TestQueryStore()

			await store.fetch(params)

			return {
				TestQuery: store,
			}
		}

		export default new TestQueryStore()
	`)
})

test('generates a store for every query', async function () {
	const config = await test_config()
	const plugin_root = config.pluginDirectory('test-plugin')

	// the documents to test
	const docs: CollectedGraphQLDocument[] = [
		mockCollectedDoc(`query TestQuery1 { version }`),
		mockCollectedDoc(`query TestQuery2 { version }`),
	]

	// execute the generator
	await runPipeline({ config, documents: docs, plugin_root })

	// look up the files in the artifact directory
	const files = await fs.readdir(global_stores_directory(plugin_root))

	// and they have the right names
	expect(files).toEqual(expect.arrayContaining(['TestQuery1.js', 'TestQuery2.js']))
	// and type definitions exist
	expect(files).toEqual(expect.arrayContaining(['TestQuery1.d.ts', 'TestQuery2.d.ts']))

	const contents = await fs.readFile(
		path.join(global_stores_directory(plugin_root), 'TestQuery1.js')
	)
	const parsed = recast.parse(contents!, {
		parser: typeScriptParser,
	}).program

	await expect(parsed).toMatchInlineSnapshot(
		`
		// import 

		export const GQL_TestQuery1 = new TestQuery1Store()
	`
	)
})
