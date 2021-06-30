// external imports
import path from 'path'
import { testConfig } from 'houdini-common'
import * as graphql from 'graphql'
import fs from 'fs/promises'
import * as recast from 'recast'
import * as typeScriptParser from 'recast/parsers/typescript'
// local imports
import '../../../../jest.setup'
import { runPipeline } from '../generate'
import { mockCollectedDoc } from '../testUtils'

// the config to use in tests
const config = testConfig({
	schema: `
		enum MyEnum { 
			Hello
		}

		type Query {
			user(id: ID, filter: UserFilter, filterList: [UserFilter!]): User
			users: [User]
		}

		type Mutation { 
			doThing(
				filter: UserFilter, 
				list: [UserFilter!]!,
				id: ID!
				firstName: String!
				admin: Boolean
				age: Int
				weight: Float
			): User
		}

		input UserFilter {
			middle: NestedUserFilter
			listRequired: [String!]!
			nullList: [String]
			recursive: UserFilter
			enum: MyEnum
		}

		input NestedUserFilter {
			id: ID!
			firstName: String!
			admin: Boolean
			age: Int
			weight: Float
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
	test('fragment types', async function () {
		// the document to test
		const doc = mockCollectedDoc(
			'TestFragment',
			`fragment TestFragment on User { firstName nickname }`
		)

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
		    readonly "shape"?: TestFragment$data,
		    readonly "$fragments": {
		        "TestFragment": true
		    }
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
		const doc = mockCollectedDoc('TestFragment', fragment)

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
		    readonly "shape"?: TestFragment$data,
		    readonly "$fragments": {
		        "TestFragment": true
		    }
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
		// the document to test
		const doc = mockCollectedDoc(
			'TestFragment',
			`fragment TestFragment on User { firstName admin age id weight }`
		)

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
		    readonly "shape"?: TestFragment$data,
		    readonly "$fragments": {
		        "TestFragment": true
		    }
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
		// the document to test
		const doc = mockCollectedDoc(
			'TestFragment',
			`fragment TestFragment on User { firstName friends { firstName } }`
		)

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
		    readonly "shape"?: TestFragment$data,
		    readonly "$fragments": {
		        "TestFragment": true
		    }
		};

		export type TestFragment$data = {
		    readonly firstName: string,
		    readonly friends: ({
		        readonly firstName: string
		    } | null)[] | null
		};
	`)
	})

	test('query with no input', async function () {
		// the document to test
		const doc = mockCollectedDoc('TestFragment', `query Query { user { firstName } }`)

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
		    readonly "input": null,
		    readonly "result": Query$result
		};

		export type Query$result = {
		    readonly user: {
		        readonly firstName: string
		    } | null
		};
	`)
	})

	test('query with root list', async function () {
		// the document with the query
		const query = `
			query Query {
				users {
					firstName,
				}
			}
		`
		const queryDoc = {
			name: 'Query',
			document: graphql.parse(query),
			originalDocument: graphql.parse(query),
			filename: 'fragment.ts',
			printed: query,
		}
		// execute the generator
		await runPipeline(config, [queryDoc])

		// look up the files in the artifact directory
		const fileContents = await fs.readFile(config.artifactTypePath(queryDoc.document), 'utf-8')

		// make sure they match what we expect
		expect(
			recast.parse(fileContents, {
				parser: typeScriptParser,
			})
		).toMatchInlineSnapshot(`
		export type Query = {
		    readonly "input": null,
		    readonly "result": Query$result
		};

		export type Query$result = {
		    readonly users: ({
		        readonly firstName: string
		    } | null)[] | null
		};
	`)
	})

	test('query with input', async function () {
		// the document to test
		const doc = mockCollectedDoc(
			'TestFragment',
			`query Query($id: ID!) { user(id: $id) { firstName } }`
		)

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
		    id: string
		};
	`)
	})

	test('mutation with input list', async function () {
		// the document to test
		const doc = mockCollectedDoc(
			'TestFragment',
			`mutation Mutation(
				$filter: UserFilter, 
				$filterList: [UserFilter!]!, 
				$id: ID!
				$firstName: String!
				$admin: Boolean
				$age: Int
				$weight: Float
			) { doThing(
				filter: $filter, 
				list: $filterList, 
				id:$id
				firstName:$firstName
				admin:$admin
				age:$age
				weight:$weight
			) { 
				firstName 
			  } 
			}`
		)

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
		export type Mutation = {
		    readonly "input": Mutation$input,
		    readonly "result": Mutation$result
		};

		export type Mutation$result = {
		    readonly doThing: {
		        readonly firstName: string
		    } | null
		};

		type NestedUserFilter = {
		    id: string,
		    firstName: string,
		    admin: boolean | null | undefined,
		    age: number | null | undefined,
		    weight: number | null | undefined
		};

		enum MyEnum {
		    Hello = "Hello"
		}

		type UserFilter = {
		    middle: NestedUserFilter | null | undefined,
		    listRequired: (string)[],
		    nullList: (string | null | undefined)[] | null | undefined,
		    recursive: UserFilter | null | undefined,
		    enum: MyEnum | null | undefined
		};

		export type Mutation$input = {
		    filter: UserFilter | null | undefined,
		    filterList: (UserFilter)[],
		    id: string,
		    firstName: string,
		    admin: boolean | null | undefined,
		    age: number | null | undefined,
		    weight: number | null | undefined
		};
	`)
	})

	test('nested input objects', async function () {
		// the document to test
		const doc = mockCollectedDoc(
			'TestFragment',
			`query Query($filter: UserFilter!) { user(filter: $filter) { firstName } }`
		)

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

		type NestedUserFilter = {
		    id: string,
		    firstName: string,
		    admin: boolean | null | undefined,
		    age: number | null | undefined,
		    weight: number | null | undefined
		};

		enum MyEnum {
		    Hello = "Hello"
		}

		type UserFilter = {
		    middle: NestedUserFilter | null | undefined,
		    listRequired: (string)[],
		    nullList: (string | null | undefined)[] | null | undefined,
		    recursive: UserFilter | null | undefined,
		    enum: MyEnum | null | undefined
		};

		export type Query$input = {
		    filter: UserFilter
		};
	`)
	})

	test('generates index file', async function () {
		// the document to test
		const doc = mockCollectedDoc(
			'Query',
			`query Query($filter: UserFilter!) { user(filter: $filter) { firstName } }`
		)

		// execute the generator
		await runPipeline(config, [doc])

		// read the type index file
		const fileContents = await fs.readFile(config.typeIndexPath, 'utf-8')

		expect(
			recast.parse(fileContents, {
				parser: typeScriptParser,
			})
		).toMatchInlineSnapshot(`
		export * from "./artifacts/Query";
		export * from "./runtime";
	`)
	})

	test('fragment spreads', async function () {
		// the document with the fragment
		const fragment = mockCollectedDoc('Foo', `fragment Foo on User { firstName }`)

		// the document to test
		const query = mockCollectedDoc('Query', `query Query { user { ...Foo } }`)

		// execute the generator
		await runPipeline(config, [query, fragment])

		// look up the files in the artifact directory
		const fileContents = await fs.readFile(config.artifactTypePath(query.document), 'utf-8')

		// make sure they match what we expect
		expect(
			recast.parse(fileContents, {
				parser: typeScriptParser,
			})
		).toMatchInlineSnapshot(`
		export type Query = {
		    readonly "input": null,
		    readonly "result": Query$result
		};

		export type Query$result = {
		    readonly user: {
		        readonly $fragments: {
		            Foo: true
		        }
		    } | null
		};
	`)
	})

	test.todo('inline fragments')

	test.todo('interface')

	test.todo('union')
})
