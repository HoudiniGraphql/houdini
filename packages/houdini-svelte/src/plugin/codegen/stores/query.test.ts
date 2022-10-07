import { fs, CollectedGraphQLDocument } from 'houdini'
import { testConfig, mockCollectedDoc } from 'houdini/test'
import path from 'path'
import * as recast from 'recast'
import * as typeScriptParser from 'recast/parsers/typescript'
import { test, expect } from 'vitest'

import runPipeline from '..'
import '../..'
import { stores_directory } from '../../kit'

// the config to use in tests
const config = testConfig()
const plugin_root = config.pluginDirectory('test-plugin')

test('generates a store for every query', async function () {
	// the documents to test
	const docs: CollectedGraphQLDocument[] = [
		mockCollectedDoc(`query TestQuery1 { version }`),
		mockCollectedDoc(`query TestQuery2 { version }`),
	]

	// execute the generator
	await runPipeline({ config, documents: docs, plugin_root })

	// look up the files in the artifact directory
	const files = await fs.readdir(stores_directory(plugin_root))

	// and they have the right names
	expect(files).toEqual(expect.arrayContaining(['TestQuery1.js', 'TestQuery2.js']))
	// and type definitions exist
	expect(files).toEqual(expect.arrayContaining(['TestQuery1.d.ts', 'TestQuery2.d.ts']))
})

test('basic store', async function () {
	const docs = [mockCollectedDoc(`query TestQuery { version }`)]

	// run the generator
	await runPipeline({ config, documents: docs, plugin_root })

	const contents = await fs.readFile(path.join(stores_directory(plugin_root), 'TestQuery.js'))

	// parse the contents
	const parsed = recast.parse(contents!, {
		parser: typeScriptParser,
	}).program

	// check the file contents
	await expect(parsed).toMatchInlineSnapshot(`
		import { QueryStore } from '../runtime/stores'
		import artifact from '../artifacts/TestQuery'

		// create the query store

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

		export const GQL_TestQuery = new TestQueryStore()

		export default GQL_TestQuery
	`)
})

test('change globalStorePrefix to "yop___"', async function () {
	const docs = [mockCollectedDoc(`query TestQuery { version }`)]

	let configTweaked = testConfig()
	configTweaked.globalStorePrefix = 'yop___'
	// run the generator
	await runPipeline({ config: configTweaked, documents: docs, plugin_root })

	const contents = await fs.readFile(path.join(stores_directory(plugin_root), 'TestQuery.js'))

	// parse the contents
	const parsed = recast.parse(contents!, {
		parser: typeScriptParser,
	}).program

	// check the file contents
	await expect(parsed).toMatchInlineSnapshot(`
		import { QueryStore } from '../runtime/stores'
		import artifact from '../artifacts/TestQuery'

		// create the query store

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

		export const yop___TestQuery = new TestQueryStore()

		export default yop___TestQuery
	`)
})

test('change globalStorePrefix to ""', async function () {
	const docs = [mockCollectedDoc(`query TestQuery { version }`)]

	let configTweaked = testConfig()
	configTweaked.globalStorePrefix = ''
	// run the generator
	await runPipeline({ config: configTweaked, documents: docs, plugin_root })

	const contents = await fs.readFile(path.join(stores_directory(plugin_root), 'TestQuery.js'))

	// parse the contents
	const parsed = recast.parse(contents!, {
		parser: typeScriptParser,
	}).program

	// check the file contents
	await expect(parsed).toMatchInlineSnapshot(`
		import { QueryStore } from '../runtime/stores'
		import artifact from '../artifacts/TestQuery'

		// create the query store

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

		export const TestQuery = new TestQueryStore()

		export default TestQuery
	`)
})

test('store with required variables', async function () {
	const docs = [
		mockCollectedDoc(
			`query TestQuery($intValue: Int!) { usersByOffset(offset: $intValue) { id }  }`
		),
	]

	// run the generator
	await runPipeline({ config, documents: docs, plugin_root })

	const contents = await fs.readFile(path.join(stores_directory(plugin_root), 'TestQuery.js'))

	// parse the contents
	const parsed = recast.parse(contents!, {
		parser: typeScriptParser,
	}).program

	// check the file contents
	await expect(parsed).toMatchInlineSnapshot(`
		import { QueryStore } from '../runtime/stores'
		import artifact from '../artifacts/TestQuery'

		// create the query store

		export class TestQueryStore extends QueryStore {
			constructor() {
				super({
					artifact,
					storeName: "TestQueryStore",
					variables: true,
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

		export const GQL_TestQuery = new TestQueryStore()

		export default GQL_TestQuery
	`)
})

test('store with nullable variables', async function () {
	const docs = [
		mockCollectedDoc(
			`query TestQuery($intValue: Int) { usersByOffset(offset: $intValue) { id }  }`
		),
	]

	// run the generator
	await runPipeline({ config, documents: docs, plugin_root })

	const contents = await fs.readFile(path.join(stores_directory(plugin_root), 'TestQuery.js'))

	// parse the contents
	const parsed = recast.parse(contents!, {
		parser: typeScriptParser,
	}).program

	// check the file contents
	await expect(parsed).toMatchInlineSnapshot(`
		import { QueryStore } from '../runtime/stores'
		import artifact from '../artifacts/TestQuery'

		// create the query store

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

		export const GQL_TestQuery = new TestQueryStore()

		export default GQL_TestQuery
	`)
})

test('store with non-null variables with default value', async function () {
	const docs = [
		mockCollectedDoc(
			`query TestQuery($intValue: Int = 2) { usersByOffset(offset: $intValue) { id }  }`
		),
	]

	// run the generator
	await runPipeline({ config, documents: docs, plugin_root })

	const contents = await fs.readFile(path.join(stores_directory(plugin_root), 'TestQuery.js'))

	// parse the contents
	const parsed = recast.parse(contents!, {
		parser: typeScriptParser,
	}).program

	// check the file contents
	await expect(parsed).toMatchInlineSnapshot(`
		import { QueryStore } from '../runtime/stores'
		import artifact from '../artifacts/TestQuery'

		// create the query store

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

		export const GQL_TestQuery = new TestQueryStore()

		export default GQL_TestQuery
	`)
})

test('forward cursor pagination', async function () {
	const docs = [
		mockCollectedDoc(`query TestQuery {
		usersByForwardsCursor(first: 10) @paginate {
			edges {
				node {
					id
				}
			}
		}
	}`),
	]

	// run the generator
	await runPipeline({ config, documents: docs, plugin_root })

	const contents = await fs.readFile(path.join(stores_directory(plugin_root), 'TestQuery.js'))

	// parse the contents
	const parsed = recast.parse(contents!, {
		parser: typeScriptParser,
	}).program

	// check the file contents
	await expect(parsed).toMatchInlineSnapshot(`
		import { QueryStoreForwardCursor } from '../runtime/stores'
		import artifact from '../artifacts/TestQuery'

		// create the query store

		export class TestQueryStore extends QueryStoreForwardCursor {
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

		export const GQL_TestQuery = new TestQueryStore()

		export default GQL_TestQuery
	`)
})

test('backwards cursor pagination', async function () {
	const docs = [
		mockCollectedDoc(`query TestQuery {
		usersByBackwardsCursor(last: 10) @paginate {
			edges {
				node {
					id
				}
			}
		}
	}`),
	]

	// run the generator
	await runPipeline({ config, documents: docs, plugin_root })

	const contents = await fs.readFile(path.join(stores_directory(plugin_root), 'TestQuery.js'))

	// parse the contents
	const parsed = recast.parse(contents!, {
		parser: typeScriptParser,
	}).program

	// check the file contents
	await expect(parsed).toMatchInlineSnapshot(`
		import { QueryStoreBackwardCursor } from '../runtime/stores'
		import artifact from '../artifacts/TestQuery'

		// create the query store

		export class TestQueryStore extends QueryStoreBackwardCursor {
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

		export const GQL_TestQuery = new TestQueryStore()

		export default GQL_TestQuery
	`)
})

test('offset pagination', async function () {
	const docs = [
		mockCollectedDoc(`query TestQuery {
		usersByOffset(limit: 10) @paginate {
			id
		}
	}`),
	]

	// run the generator
	await runPipeline({ config, documents: docs, plugin_root })

	const contents = await fs.readFile(path.join(stores_directory(plugin_root), 'TestQuery.js'))

	// parse the contents
	const parsed = recast.parse(contents!, {
		parser: typeScriptParser,
	}).program

	// check the file contents
	await expect(parsed).toMatchInlineSnapshot(`
		import { QueryStoreOffset } from '../runtime/stores'
		import artifact from '../artifacts/TestQuery'

		// create the query store

		export class TestQueryStore extends QueryStoreOffset {
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

		export const GQL_TestQuery = new TestQueryStore()

		export default GQL_TestQuery
	`)
})

test('does not generate pagination store', async function () {
	const docs = [
		mockCollectedDoc(`query TestQuery {
		usersByBackwardsCursor(last: 10) @paginate {
			edges {
				node {
					id
				}
			}
		}
	}`),
	]

	// run the generator
	await runPipeline({ config, documents: docs, plugin_root })

	await expect(
		fs.stat(
			path.join(
				stores_directory(plugin_root),
				config.paginationQueryName('TestQuery') + '.js'
			)
		)
	).rejects.toBeTruthy()
})
