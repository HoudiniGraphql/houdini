// external imports
import fs from 'fs/promises'
import * as recast from 'recast'
import * as typeScriptParser from 'recast/parsers/typescript'
// local imports
import { testConfig } from '../../../common'
import '../../../../jest.setup'
import { runPipeline } from '../../generate'
import { mockCollectedDoc } from '../../testUtils'

// the config to use in tests
const config = testConfig({
	schema: `
		enum MyEnum {
			Hello
		}

		type Query {
			user(id: ID, filter: UserFilter, filterList: [UserFilter!], enumArg: MyEnum): User
			users: [User]
			nodes: [Node!]!
			entities: [Entity]
			listOfLists: [[User]]!
			node(id: ID!): Node
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

		interface Node {
			id: ID!
		}

		type Cat implements Node & Animal {
			id: ID!
			kitty: Boolean!
			isAnimal: Boolean!
		}

		interface Animal {
			isAnimal: Boolean!
		}

		union Entity = User | Cat

		union AnotherEntity = User | Ghost

		type Ghost {
			aka: String!
		}

		type User implements Node {
			id: ID!

			firstName: String!
			nickname: String
			parent: User
			friends: [User]
			enumValue: MyEnum

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
			`fragment TestFragment on User { firstName nickname enumValue }`
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
		enum MyEnum {
		    Hello = "Hello"
		}

		export type TestFragment = {
		    readonly "shape"?: TestFragment$data,
		    readonly "$fragments": {
		        "TestFragment": true
		    }
		};

		export type TestFragment$data = {
		    readonly firstName: string,
		    readonly nickname: string | null,
		    readonly enumValue: MyEnum | null
		};
	`)
	})

	test('nested types', async function () {
		const fragment = `fragment TestFragment on User { firstName parent { firstName } }`

		// the document to test
		const doc = mockCollectedDoc(fragment)

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
		const doc = mockCollectedDoc(`query Query { user { firstName } }`)

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
		    readonly "result": Query$result | undefined
		};

		export type Query$result = {
		    readonly user: {
		        readonly firstName: string
		    } | null
		};

		export type Query$afterLoad = {
		    readonly "data": {
		        readonly "Query": Query$result
		    }
		};
	`)
	})

	test('query with root list', async function () {
		// the document with the query
		const queryDoc = mockCollectedDoc(`
			query Query {
				users {
					firstName,
				}
			}
		`)
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
		    readonly "result": Query$result | undefined
		};

		export type Query$result = {
		    readonly users: ({
		        readonly firstName: string
		    } | null)[] | null
		};

		export type Query$afterLoad = {
		    readonly "data": {
		        readonly "Query": Query$result
		    }
		};
	`)
	})

	test('query with input', async function () {
		// the document to test
		const doc = mockCollectedDoc(
			`query Query($id: ID!, $enum: MyEnum) { user(id: $id, enumArg: $enum ) { firstName } }`
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
		    readonly "result": Query$result | undefined
		};

		export type Query$result = {
		    readonly user: {
		        readonly firstName: string
		    } | null
		};

		export type Query$afterLoad = {
		    readonly "input": {
		        readonly "Query": Query$input
		    },
		    readonly "data": {
		        readonly "Query": Query$result
		    }
		};

		enum MyEnum {
		    Hello = "Hello"
		}

		export type Query$input = {
		    id: string,
		    enum?: MyEnum | null | undefined
		};
	`)
	})

	test('mutation with input list', async function () {
		// the document to test
		const doc = mockCollectedDoc(
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
		    admin?: boolean | null | undefined,
		    age?: number | null | undefined,
		    weight?: number | null | undefined
		};

		enum MyEnum {
		    Hello = "Hello"
		}

		type UserFilter = {
		    middle?: NestedUserFilter | null | undefined,
		    listRequired: (string)[],
		    nullList?: (string | null | undefined)[] | null | undefined,
		    recursive?: UserFilter | null | undefined,
		    enum?: MyEnum | null | undefined
		};

		export type Mutation$input = {
		    filter?: UserFilter | null | undefined,
		    filterList: (UserFilter)[],
		    id: string,
		    firstName: string,
		    admin?: boolean | null | undefined,
		    age?: number | null | undefined,
		    weight?: number | null | undefined
		};
	`)
	})

	test('nested input objects', async function () {
		// the document to test
		const doc = mockCollectedDoc(
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
		    readonly "result": Query$result | undefined
		};

		export type Query$result = {
		    readonly user: {
		        readonly firstName: string
		    } | null
		};

		export type Query$afterLoad = {
		    readonly "input": {
		        readonly "Query": Query$input
		    },
		    readonly "data": {
		        readonly "Query": Query$result
		    }
		};

		type NestedUserFilter = {
		    id: string,
		    firstName: string,
		    admin?: boolean | null | undefined,
		    age?: number | null | undefined,
		    weight?: number | null | undefined
		};

		enum MyEnum {
		    Hello = "Hello"
		}

		type UserFilter = {
		    middle?: NestedUserFilter | null | undefined,
		    listRequired: (string)[],
		    nullList?: (string | null | undefined)[] | null | undefined,
		    recursive?: UserFilter | null | undefined,
		    enum?: MyEnum | null | undefined
		};

		export type Query$input = {
		    filter: UserFilter
		};
	`)
	})

	test('generates index file', async function () {
		// the document to test
		const doc = mockCollectedDoc(
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
		export * from "./stores";
	`)
	})

	test('fragment spreads', async function () {
		// the document with the fragment
		const fragment = mockCollectedDoc(`fragment Foo on User { firstName }`)

		// the document to test
		const query = mockCollectedDoc(`query Query { user { ...Foo } }`)

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
		    readonly "result": Query$result | undefined
		};

		export type Query$result = {
		    readonly user: {
		        readonly $fragments: {
		            Foo: true
		        }
		    } | null
		};

		export type Query$afterLoad = {
		    readonly "data": {
		        readonly "Query": Query$result
		    }
		};
	`)
	})

	test('fragment spreads no masking', async function () {
		const withoutMasking = testConfig({ disableMasking: true })

		// the document with the fragment
		const fragment = mockCollectedDoc(`fragment Foo on User { firstName }`)

		// the document to test
		const query = mockCollectedDoc(`query Query { user { ...Foo } }`)

		// execute the generator
		await runPipeline(withoutMasking, [query, fragment])

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
		    readonly "result": Query$result | undefined
		};

		export type Query$result = {
		    readonly user: {
		        readonly firstName: string,
		        readonly $fragments: {
		            Foo: true
		        }
		    }
		};

		export type Query$afterLoad = {
		    readonly "data": {
		        readonly "Query": Query$result
		    }
		};
	`)
	})

	test('interfaces', async function () {
		// the document to test
		const query = mockCollectedDoc(
			`
			query Query {
				nodes {
					... on User {
						id
					}
					... on Cat {
						id
					}
				}
			}
		`
		)

		// execute the generator
		await runPipeline(config, [query])

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
		    readonly "result": Query$result | undefined
		};

		export type Query$result = {
		    readonly nodes: ({} & (({
		        readonly id: string,
		        readonly __typename: "User"
		    }) | ({
		        readonly id: string,
		        readonly __typename: "Cat"
		    })))[]
		};

		export type Query$afterLoad = {
		    readonly "data": {
		        readonly "Query": Query$result
		    }
		};
	`)
	})

	test('unions', async function () {
		// the document to test
		const query = mockCollectedDoc(
			`
			query Query {
				entities {
					... on User {
						id
					}
					... on Cat {
						id
					}
				}
			}
		`
		)

		// execute the generator
		await runPipeline(config, [query])

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
		    readonly "result": Query$result | undefined
		};

		export type Query$result = {
		    readonly entities: ({} & (({
		        readonly id: string,
		        readonly __typename: "User"
		    }) | ({
		        readonly id: string,
		        readonly __typename: "Cat"
		    })) | null)[] | null
		};

		export type Query$afterLoad = {
		    readonly "data": {
		        readonly "Query": Query$result
		    }
		};
	`)
	})

	test('discriminated interface', async function () {
		// the document to test
		const query = mockCollectedDoc(
			`
			query Query {
				nodes {
					id
					... on User {
						firstName
					}
					... on Cat {
						kitty
					}
				}
			}
		`
		)

		// execute the generator
		await runPipeline(config, [query])

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
		    readonly "result": Query$result | undefined
		};

		export type Query$result = {
		    readonly nodes: ({
		        readonly id: string
		    } & (({
		        readonly firstName: string,
		        readonly __typename: "User"
		    }) | ({
		        readonly kitty: boolean,
		        readonly __typename: "Cat"
		    })))[]
		};

		export type Query$afterLoad = {
		    readonly "data": {
		        readonly "Query": Query$result
		    }
		};
	`)
	})

	test('intersecting interface', async function () {
		// the document to test
		const query = mockCollectedDoc(
			`
			query Query {
				entities {
					... on Animal {
						isAnimal
					}
					... on User {
						firstName
					}
					... on Cat {
						kitty
					}
				}
			}
		`
		)

		// execute the generator
		await runPipeline(config, [query])

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
		    readonly "result": Query$result | undefined
		};

		export type Query$result = {
		    readonly entities: ({} & (({
		        readonly firstName: string,
		        readonly __typename: "User"
		    }) | ({
		        readonly kitty: boolean,
		        readonly __typename: "Cat"
		    } & {
		        readonly isAnimal: boolean
		    })) | null)[] | null
		};

		export type Query$afterLoad = {
		    readonly "data": {
		        readonly "Query": Query$result
		    }
		};
	`)
	})

	test('fragment with custom scalars', async function () {
		// define a config with a custom scalar
		const localConfig = testConfig({
			schema: `
		scalar DateTime

		type TodoItem {
			text: String!
			createdAt: DateTime!
		}

		type Query {
			allItems: [TodoItem!]!
		}
	`,
			scalars: {
				DateTime: {
					type: 'Date',
					unmarshal(val: number): Date {
						return new Date(val)
					},
					marshal(date: Date): number {
						return date.getTime()
					},
				},
			},
		})

		// the document to test
		const query = mockCollectedDoc(`query Query { allItems { createdAt } }`)

		// execute the generator
		await runPipeline(localConfig, [query])

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
		    readonly "result": Query$result | undefined
		};

		export type Query$result = {
		    readonly allItems: ({
		        readonly createdAt: Date
		    })[]
		};

		export type Query$afterLoad = {
		    readonly "data": {
		        readonly "Query": Query$result
		    }
		};
	`)
	})

	test('input with custom scalars', async function () {
		// define a config with a custom scalar
		const localConfig = testConfig({
			schema: `
		scalar DateTime

		type TodoItem {
			text: String!
			createdAt: DateTime!
		}

		type Query {
			allItems(createdAt: DateTime): [TodoItem!]!
		}
	`,
			scalars: {
				DateTime: {
					type: 'Date',
					unmarshal(val: number): Date {
						return new Date(val)
					},
					marshal(date: Date): number {
						return date.getTime()
					},
				},
			},
		})

		// the document to test
		const query = mockCollectedDoc(
			`query Query($date: DateTime!) { allItems(createdAt: $date) { createdAt } }`
		)

		// execute the generator
		await runPipeline(localConfig, [query])

		// look up the files in the artifact directory
		const fileContents = await fs.readFile(config.artifactTypePath(query.document), 'utf-8')

		// make sure they match what we expect
		expect(
			recast.parse(fileContents, {
				parser: typeScriptParser,
			})
		).toMatchInlineSnapshot(`
		export type Query = {
		    readonly "input": Query$input,
		    readonly "result": Query$result | undefined
		};

		export type Query$result = {
		    readonly allItems: ({
		        readonly createdAt: Date
		    })[]
		};

		export type Query$afterLoad = {
		    readonly "input": {
		        readonly "Query": Query$input
		    },
		    readonly "data": {
		        readonly "Query": Query$result
		    }
		};

		export type Query$input = {
		    date: Date
		};
	`)
	})

	test('can generate types for list of lists', async function () {
		// the document to test
		const query = mockCollectedDoc(
			`
			query Query {
				listOfLists {
					firstName
					nickname
				}
			}
		`
		)

		// execute the generator
		await runPipeline(config, [query])

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
		    readonly "result": Query$result | undefined
		};

		export type Query$result = {
		    readonly listOfLists: (({
		        readonly firstName: string,
		        readonly nickname: string | null
		    } | null)[] | null)[]
		};

		export type Query$afterLoad = {
		    readonly "data": {
		        readonly "Query": Query$result
		    }
		};
	`)
	})

	test('duplicate fields', async function () {
		// the document to test
		const query = mockCollectedDoc(`query Query {
			user {
				parent {
					firstName
					firstName
				}
				parent {
					nickname
				}
			}
		}`)

		// execute the generator
		await runPipeline(config, [query])

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
		    readonly "result": Query$result | undefined
		};

		export type Query$result = {
		    readonly user: {
		        readonly parent: {
		            readonly firstName: string,
		            readonly nickname: string | null
		        } | null
		    } | null
		};

		export type Query$afterLoad = {
		    readonly "data": {
		        readonly "Query": Query$result
		    }
		};
	`)
	})

	test.todo('fragments on interfaces')

	test.todo('intersections with __typename in subselection')

	test.todo('inline fragments')
})
