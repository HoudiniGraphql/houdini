import { ProgramKind } from 'ast-types/gen/kinds'
import path, { parse } from 'path'
import * as recast from 'recast'
import * as typeScriptParser from 'recast/parsers/typescript'

import '../../../../jest.setup'
import { testConfig } from '../../../common'
import * as fs from '../../../common/fs'
import { runPipeline } from '../../generate'
import { mockCollectedDoc } from '../../testUtils'
import { CollectedGraphQLDocument } from '../../types'

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

	const contents = await fs.readFile(path.join(config.storesDirectory, 'TestQuery.js'))

	// parse the contents
	const parsed = recast.parse(contents!, {
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
					    paginationMethods: [],
						variables: false,
					})

					export const GQL_TestQuery = factory()

					export const TestQueryStore = factory

					export default GQL_TestQuery
				`)
})

test('store with required variables', async function () {
	const docs = [
		mockCollectedDoc(
			`query TestQuery($intValue: Int!) { usersByOffset(offset: $intValue) { id }  }`
		),
	]

	// run the generator
	await runPipeline(config, docs)

	const contents = await fs.readFile(path.join(config.storesDirectory, 'TestQuery.js'))

	// parse the contents
	const parsed = recast.parse(contents!, {
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
					    paginationMethods: [],
						variables: true,
					})

					export const GQL_TestQuery = factory()

					export const TestQueryStore = factory

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
	await runPipeline(config, docs)

	const contents = await fs.readFile(path.join(config.storesDirectory, 'TestQuery.js'))

	// parse the contents
	const parsed = recast.parse(contents!, {
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
					    paginationMethods: [],
						variables: false,
					})

					export const GQL_TestQuery = factory()

					export const TestQueryStore = factory

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
	await runPipeline(config, docs)

	const contents = await fs.readFile(path.join(config.storesDirectory, 'TestQuery.js'))

	// parse the contents
	const parsed = recast.parse(contents!, {
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
					    paginationMethods: [],
						variables: false,
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

	const contents = await fs.readFile(path.join(config.storesDirectory, 'TestQuery.js'))

	// parse the contents
	const parsed = recast.parse(contents!, {
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
					    paginationMethods: ["loadNextPage","fetch","loading"],
						variables: false,
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

	const contents = await fs.readFile(path.join(config.storesDirectory, 'TestQuery.js'))

	// parse the contents
	const parsed = recast.parse(contents!, {
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
					    paginationMethods: ["loadPreviousPage","fetch","loading"],
						variables: false,
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

	const contents = await fs.readFile(path.join(config.storesDirectory, 'TestQuery.js'))

	// parse the contents
	const parsed = recast.parse(contents!, {
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
					    paginationMethods: ["loadNextPage","fetch","loading"],
						variables: false,
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
		fs.stat(path.join(config.storesDirectory, config.paginationQueryName('TestQuery') + '.js'))
	).rejects.toBeTruthy()
})
