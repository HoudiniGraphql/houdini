// external imports
import path, { parse } from 'path'
import fs from 'fs/promises'
import * as typeScriptParser from 'recast/parsers/typescript'
import { ProgramKind } from 'ast-types/gen/kinds'
import * as recast from 'recast'
// local imports
import { testConfig } from '../../../common'
import '../../../../jest.setup'
import { runPipeline } from '../../generate'
import { CollectedGraphQLDocument } from '../../types'
import { mockCollectedDoc } from '../../testUtils'
import { readFile, stat } from 'fs/promises'

// the config to use in tests
const config = testConfig()

test('generates a store for every query', async function () {
	// the documents to test
	const docs: CollectedGraphQLDocument[] = [
		mockCollectedDoc(`query TestQuery1 { version }`),
		mockCollectedDoc(`query TestQuery2 { version }`),
	]

	// execute the generator
	await runPipeline(config, docs)

	// look up the files in the artifact directory
	const files = await fs.readdir(config.storesDirectory)

	// and they have the right names
	expect(files).toEqual(expect.arrayContaining(['TestQuery1.js', 'TestQuery2.js']))
	// and type definitions exist
	expect(files).toEqual(expect.arrayContaining(['TestQuery1.d.ts', 'TestQuery2.d.ts']))
})

test('basic store', async function () {
	const docs = [mockCollectedDoc(`query TestQuery { version }`)]

	// run the generator
	await runPipeline(config, docs)

	const contents = await readFile(path.join(config.storesDirectory, 'TestQuery.js'), 'utf-8')

	// parse the contents
	const parsed = recast.parse(contents, {
		parser: typeScriptParser,
	}).program

	// check the file contents
	await expect(parsed).toMatchInlineSnapshot(`
					import { houdiniConfig } from '$houdini';
					import { queryStore } from '../runtime/stores'
					import artifact from '../artifacts/TestQuery'
					import { defaultConfigValues } from '../runtime/lib'

					// create the query store
					const factory = () => queryStore({
					    artifact,
					    config: defaultConfigValues(houdiniConfig),
					    storeName: "GQL_TestQuery",
					    paginated: false,
					    paginationMethods: {}
					})

					export const GQL_TestQuery = factory()

					export const TestQueryStore = factory

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
	await runPipeline(config, docs)

	const contents = await readFile(path.join(config.storesDirectory, 'TestQuery.js'), 'utf-8')

	// parse the contents
	const parsed = recast.parse(contents, {
		parser: typeScriptParser,
	}).program

	// check the file contents
	await expect(parsed).toMatchInlineSnapshot(`
					import { houdiniConfig } from '$houdini';
					import { queryStore } from '../runtime/stores'
					import artifact from '../artifacts/TestQuery'
					import { defaultConfigValues } from '../runtime/lib'

					// create the query store
					const factory = () => queryStore({
					    artifact,
					    config: defaultConfigValues(houdiniConfig),
					    storeName: "GQL_TestQuery",
					    paginated: true,
					    paginationMethods: {
					        "loadNextPage": "loadNextPage",
					        "pageInfos": "pageInfos",
					        "fetch": "refetch",
					        "loading": "loading"
					    }
					})

					export const GQL_TestQuery = factory()

					export const TestQueryStore = factory

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
	await runPipeline(config, docs)

	const contents = await readFile(path.join(config.storesDirectory, 'TestQuery.js'), 'utf-8')

	// parse the contents
	const parsed = recast.parse(contents, {
		parser: typeScriptParser,
	}).program

	// check the file contents
	await expect(parsed).toMatchInlineSnapshot(`
					import { houdiniConfig } from '$houdini';
					import { queryStore } from '../runtime/stores'
					import artifact from '../artifacts/TestQuery'
					import { defaultConfigValues } from '../runtime/lib'

					// create the query store
					const factory = () => queryStore({
					    artifact,
					    config: defaultConfigValues(houdiniConfig),
					    storeName: "GQL_TestQuery",
					    paginated: true,
					    paginationMethods: {
					        "loadPreviousPage": "loadPreviousPage",
					        "pageInfos": "pageInfos",
					        "fetch": "refetch",
					        "loading": "loading"
					    }
					})

					export const GQL_TestQuery = factory()

					export const TestQueryStore = factory

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
	await runPipeline(config, docs)

	const contents = await readFile(path.join(config.storesDirectory, 'TestQuery.js'), 'utf-8')

	// parse the contents
	const parsed = recast.parse(contents, {
		parser: typeScriptParser,
	}).program

	// check the file contents
	await expect(parsed).toMatchInlineSnapshot(`
					import { houdiniConfig } from '$houdini';
					import { queryStore } from '../runtime/stores'
					import artifact from '../artifacts/TestQuery'
					import { defaultConfigValues } from '../runtime/lib'

					// create the query store
					const factory = () => queryStore({
					    artifact,
					    config: defaultConfigValues(houdiniConfig),
					    storeName: "GQL_TestQuery",
					    paginated: true,
					    paginationMethods: {
					        "loadNextPage": "loadNextPage",
					        "fetch": "refetch",
					        "loading": "loading"
					    }
					})

					export const GQL_TestQuery = factory()

					export const TestQueryStore = factory

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
	await runPipeline(config, docs)

	await expect(
		stat(path.join(config.storesDirectory, config.paginationQueryName('TestQuery') + '.js'))
	).rejects.toBeTruthy()
})
