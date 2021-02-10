// external imports
import path from 'path'
import { testConfig } from 'houdini-common'
import * as graphql from 'graphql'
import fs from 'fs/promises'
import * as recast from 'recast'
import * as typeScriptParser from 'recast/parsers/typescript'
// local imports
import '../../../../jest.setup'
import { runPipeline } from '../compile'

// the config to use in tests
const config = testConfig({
	schema: `
		type Query {
			user(id: ID, filter: UserFilter): User
		}

		input UserFilter {
			middle: NestedUserFilter
		}

		input NestedUserFilter {
			search: String
		}

		type User {
			id: ID!

			firstName: String!
			nickname: String
			parent: User
			friends: [User]

			admin: Boolean
			age: Int
			weight: Float
		}

	`,
})

describe('typescript', function () {
	test('query types', async function () {
		const query = `query Query($id: ID!) { user(id: $id) { firstName } }`
		// the document to test
		const doc = {
			name: 'TestFragment',
			document: graphql.parse(query),
			originalDocument: graphql.parse(query),
			filename: 'fragment.ts',
			printed: query,
		}

		// execute the generator
		await runPipeline(config, [doc])

		// look up the files in the artifact directory
		const fileContents = await fs.readFile(config.artifactTypePath(doc.document), 'utf-8')

		// make sure they match what we expect
		expect(
			recast.parse(fileContents, {
				parser: typeScriptParser,
			})
		).toMatchInlineSnapshot(`
		export type Query = {
		    readonly "input": Query$input,
		    readonly "result": Query$result
		};

		export type Query$result = {
		    readonly user: {
		        readonly firstName: string
		    } | null
		};

		export type Query$input = {
		    id: string | null | undefined
		};
	`)
	})

	test('nested input objects', async function () {
		const query = `query Query($filter: UserFilter!) { user(filter: $filter) { firstName } }`
		// the document to test
		const doc = {
			name: 'TestFragment',
			document: graphql.parse(query),
			originalDocument: graphql.parse(query),
			filename: 'fragment.ts',
			printed: query,
		}

		// execute the generator
		await runPipeline(config, [doc])

		// look up the files in the artifact directory
		const fileContents = await fs.readFile(config.artifactTypePath(doc.document), 'utf-8')

		// make sure they match what we expect
		expect(
			recast.parse(fileContents, {
				parser: typeScriptParser,
			})
		).toMatchInlineSnapshot(`
		export type Query = {
		    readonly "input": Query$input,
		    readonly "result": Query$result
		};

		export type Query$result = {
		    readonly user: {
		        readonly firstName: string
		    } | null
		};

		export type Query$input = {
		    filter: {
		        middle: {
		            search: string | null | undefined
		        } | null | undefined
		    } | null | undefined
		};
	`)
	})

	test('fragment types', async function () {
		// the document to test
		const doc = {
			name: 'TestFragment',
			document: graphql.parse(`fragment TestFragment on User { firstName nickname }`),
			originalDocument: graphql.parse(`fragment TestFragment on User { firstName nickname }`),
			filename: 'fragment.ts',
			printed: `fragment TestFragment on User { firstName nickname }`,
		}

		// execute the generator
		await runPipeline(config, [doc])

		// look up the files in the artifact directory
		const fileContents = await fs.readFile(config.artifactTypePath(doc.document), 'utf-8')

		// make sure they match what we expect
		expect(
			recast.parse(fileContents, {
				parser: typeScriptParser,
			})
		).toMatchInlineSnapshot(`
		export type TestFragment = {
		    readonly "shape": TestFragment$data
		};

		export type TestFragment$data = {
		    readonly firstName: string,
		    readonly nickname: string | null
		};
	`)
	})

	test('nested types', async function () {
		const fragment = `fragment TestFragment on User { firstName parent { firstName } }`

		// the document to test
		const doc = {
			name: 'TestFragment',
			document: graphql.parse(fragment),
			originalDocument: graphql.parse(fragment),
			filename: 'fragment.ts',
			printed: fragment,
		}

		// execute the generator
		await runPipeline(config, [doc])

		// look up the files in the artifact directory
		const fileContents = await fs.readFile(config.artifactTypePath(doc.document), 'utf-8')

		// make sure they match what we expect
		expect(
			recast.parse(fileContents, {
				parser: typeScriptParser,
			})
		).toMatchInlineSnapshot(`
		export type TestFragment = {
		    readonly "shape": TestFragment$data
		};

		export type TestFragment$data = {
		    readonly firstName: string,
		    readonly parent: {
		        readonly firstName: string
		    } | null
		};
	`)
	})

	test('scalars', async function () {
		const fragment = `fragment TestFragment on User { firstName admin age id weight }`

		// the document to test
		const doc = {
			name: 'TestFragment',
			document: graphql.parse(fragment),
			originalDocument: graphql.parse(fragment),
			filename: 'fragment.ts',
			printed: fragment,
		}

		// execute the generator
		await runPipeline(config, [doc])

		// look up the files in the artifact directory
		const fileContents = await fs.readFile(config.artifactTypePath(doc.document), 'utf-8')

		// make sure they match what we expect
		expect(
			recast.parse(fileContents, {
				parser: typeScriptParser,
			})
		).toMatchInlineSnapshot(`
		export type TestFragment = {
		    readonly "shape": TestFragment$data
		};

		export type TestFragment$data = {
		    readonly firstName: string,
		    readonly admin: boolean | null,
		    readonly age: number | null,
		    readonly id: string,
		    readonly weight: number | null
		};
	`)
	})

	test('list types', async function () {
		const fragment = `fragment TestFragment on User { firstName friends { firstName } }`

		// the document to test
		const doc = {
			name: 'TestFragment',
			document: graphql.parse(fragment),
			originalDocument: graphql.parse(fragment),
			filename: 'fragment.ts',
			printed: fragment,
		}

		// execute the generator
		await runPipeline(config, [doc])

		// look up the files in the artifact directory
		const fileContents = await fs.readFile(config.artifactTypePath(doc.document), 'utf-8')

		// make sure they match what we expect
		expect(
			recast.parse(fileContents, {
				parser: typeScriptParser,
			})
		).toMatchInlineSnapshot(`
		export type TestFragment = {
		    readonly "shape": TestFragment$data
		};

		export type TestFragment$data = {
		    readonly firstName: string,
		    readonly friends: ({
		        readonly firstName: string
		    } | null)[] | null
		};
	`)
	})

	test.skip('fragment spreads', function () {})

	test.skip('inline fragments', function () {})
})
