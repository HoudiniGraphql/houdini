import type { Document } from 'houdini'
import { fs, path } from 'houdini'
import { mockCollectedDoc } from 'houdini/test'
import * as recast from 'recast'
import * as typeScriptParser from 'recast/parsers/typescript'
import { test, expect } from 'vitest'

import runPipeline from '..'
import '../..'
import { pipeline_test, test_config } from '../../../test'
import { stores_directory } from '../../kit'

test('generates a query store for every query', async function () {
	const config = await test_config()
	const plugin_root = config.pluginDirectory('test-plugin')

	// the documents to test
	const docs: Document[] = [
		mockCollectedDoc(`query TestQuery1 { version }`),
		mockCollectedDoc(`query TestQuery2 { version }`),
	]

	// execute the generator
	await runPipeline({ config, documents: docs, plugin_root, framework: 'kit' })

	// look up the files in the artifact directory
	const files = await fs.readdir(stores_directory(plugin_root))

	// and they have the right names
	expect(files).toEqual(expect.arrayContaining(['TestQuery1.js', 'TestQuery2.js']))
	// and type definitions exist
	expect(files).toEqual(expect.arrayContaining(['TestQuery1.d.ts', 'TestQuery2.d.ts']))
})

test('basic store', async function () {
	const docs = [`query TestQuery { version }`]

	const { plugin_root } = await pipeline_test(docs)

	const contents = await fs.readFile(path.join(stores_directory(plugin_root), 'TestQuery.js'))

	// parse the contents
	const parsed = recast.parse(contents!, {
		parser: typeScriptParser,
	}).program

	// check the file contents
	await expect(parsed).toMatchInlineSnapshot('null')
})

test('store with required variables', async function () {
	const docs = [`query TestQuery($intValue: Int!) { usersByOffset(offset: $intValue) { id }  }`]

	const { plugin_root } = await pipeline_test(docs)

	const contents = await fs.readFile(path.join(stores_directory(plugin_root), 'TestQuery.js'))

	// parse the contents
	const parsed = recast.parse(contents!, {
		parser: typeScriptParser,
	}).program

	// check the file contents
	await expect(parsed).toMatchInlineSnapshot('null')
})

test('store with nullable variables', async function () {
	const docs = [`query TestQuery($intValue: Int) { usersByOffset(offset: $intValue) { id }  }`]

	const { plugin_root } = await pipeline_test(docs)

	const contents = await fs.readFile(path.join(stores_directory(plugin_root), 'TestQuery.js'))

	// parse the contents
	const parsed = recast.parse(contents!, {
		parser: typeScriptParser,
	}).program

	// check the file contents
	await expect(parsed).toMatchInlineSnapshot('null')
})

test('store with non-null variables with default value', async function () {
	const docs = [
		`query TestQuery($intValue: Int = 2) { usersByOffset(offset: $intValue) { id }  }`,
	]

	const { plugin_root } = await pipeline_test(docs)

	const contents = await fs.readFile(path.join(stores_directory(plugin_root), 'TestQuery.js'))

	// parse the contents
	const parsed = recast.parse(contents!, {
		parser: typeScriptParser,
	}).program

	// check the file contents
	await expect(parsed).toMatchInlineSnapshot('null')
})

test('forward cursor pagination', async function () {
	const docs = [
		`query TestQuery {
		usersByForwardsCursor(first: 10) @paginate {
			edges {
				node {
					id
				}
			}
		}
	}`,
	]

	const { plugin_root } = await pipeline_test(docs)

	const contents = await fs.readFile(path.join(stores_directory(plugin_root), 'TestQuery.js'))

	// parse the contents
	const parsed = recast.parse(contents!, {
		parser: typeScriptParser,
	}).program

	// check the file contents
	await expect(parsed).toMatchInlineSnapshot('null')
})

test('backwards cursor pagination', async function () {
	const docs = [
		`query TestQuery {
		usersByBackwardsCursor(last: 10) @paginate {
			edges {
				node {
					id
				}
			}
		}
	}`,
	]

	const { plugin_root } = await pipeline_test(docs)

	const contents = await fs.readFile(path.join(stores_directory(plugin_root), 'TestQuery.js'))

	// parse the contents
	const parsed = recast.parse(contents!, {
		parser: typeScriptParser,
	}).program

	// check the file contents
	await expect(parsed).toMatchInlineSnapshot('null')
})

test('offset pagination', async function () {
	const docs = [
		`query TestQuery {
			usersByOffset(limit: 10) @paginate {
				id
			}
		}`,
	]

	const { plugin_root } = await pipeline_test(docs)

	const contents = await fs.readFile(path.join(stores_directory(plugin_root), 'TestQuery.js'))

	// parse the contents
	const parsed = recast.parse(contents!, {
		parser: typeScriptParser,
	}).program

	// check the file contents
	await expect(parsed).toMatchInlineSnapshot('null')
})

test('does not generate pagination store', async function () {
	const docs = [
		`query TestQuery {
		usersByBackwardsCursor(last: 10) @paginate {
			edges {
				node {
					id
				}
			}
		}
	}`,
	]

	const { plugin_root, config } = await pipeline_test(docs)

	await expect(
		fs.stat(
			path.join(
				stores_directory(plugin_root),
				config.paginationQueryName('TestQuery') + '.js'
			)
		)
	).rejects.toBeTruthy()
})
