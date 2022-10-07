import * as recast from 'recast'
import * as typeScriptParser from 'recast/parsers/typescript'
import { test, expect, describe } from 'vitest'

import { runPipeline } from '../..'
import { fs } from '../../../lib'
import { testConfig, mockCollectedDoc } from '../../../test'

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
			entity: Entity!
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

		type Ghost implements Node {
			id: ID!
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
		const fileContents = await fs.readFile(config.artifactTypePath(doc.document))

		// make sure they match what we expect
		expect(
			recast.parse(fileContents!, {
				parser: typeScriptParser,
			})
		).toMatchInlineSnapshot(`
			import { MyEnum } from "$houdini/graphql/enums";

			export type TestFragment = {
			    readonly "shape"?: TestFragment$data
			    readonly "$fragments": {
			        "TestFragment": true
			    }
			};

			export type TestFragment$data = {
			    readonly firstName: string
			    readonly nickname: string | null
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
		const fileContents = await fs.readFile(config.artifactTypePath(doc.document))

		// make sure they match what we expect
		expect(
			recast.parse(fileContents!, {
				parser: typeScriptParser,
			})
		).toMatchInlineSnapshot(`
			export type TestFragment = {
			    readonly "shape"?: TestFragment$data
			    readonly "$fragments": {
			        "TestFragment": true
			    }
			};

			export type TestFragment$data = {
			    readonly firstName: string
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
		const fileContents = await fs.readFile(config.artifactTypePath(doc.document))

		// make sure they match what we expect
		expect(
			recast.parse(fileContents!, {
				parser: typeScriptParser,
			})
		).toMatchInlineSnapshot(`
			export type TestFragment = {
			    readonly "shape"?: TestFragment$data
			    readonly "$fragments": {
			        "TestFragment": true
			    }
			};

			export type TestFragment$data = {
			    readonly firstName: string
			    readonly admin: boolean | null
			    readonly age: number | null
			    readonly id: string
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
		const fileContents = await fs.readFile(config.artifactTypePath(doc.document))

		// make sure they match what we expect
		expect(
			recast.parse(fileContents!, {
				parser: typeScriptParser,
			})
		).toMatchInlineSnapshot(`
			export type TestFragment = {
			    readonly "shape"?: TestFragment$data
			    readonly "$fragments": {
			        "TestFragment": true
			    }
			};

			export type TestFragment$data = {
			    readonly firstName: string
			    readonly friends: ({
			        readonly firstName: string
			    } | null)[] | null
			};
		`)
	})

	test('query with no input', async function () {
		// the document to test
		const doc = mockCollectedDoc(`query MyQuery { user { firstName } }`)

		// execute the generator
		await runPipeline(config, [doc])

		// look up the files in the artifact directory
		const fileContents = await fs.readFile(config.artifactTypePath(doc.document))

		// make sure they match what we expect
		expect(
			recast.parse(fileContents!, {
				parser: typeScriptParser,
			})
		).toMatchInlineSnapshot(`
			export type MyQuery = {
			    readonly "input": MyQuery$input
			    readonly "result": MyQuery$result | undefined
			};

			export type MyQuery$result = {
			    readonly user: {
			        readonly firstName: string
			    } | null
			};

			export type MyQuery$input = null;
		`)
	})

	test('query with root list', async function () {
		// the document with the query
		const queryDoc = mockCollectedDoc(`
			query MyQuery {
				users {
					firstName,
				}
			}
		`)
		// execute the generator
		await runPipeline(config, [queryDoc])

		// look up the files in the artifact directory
		const fileContents = await fs.readFile(config.artifactTypePath(queryDoc.document))

		// make sure they match what we expect
		expect(
			recast.parse(fileContents!, {
				parser: typeScriptParser,
			})
		).toMatchInlineSnapshot(`
			export type MyQuery = {
			    readonly "input": MyQuery$input
			    readonly "result": MyQuery$result | undefined
			};

			export type MyQuery$result = {
			    readonly users: ({
			        readonly firstName: string
			    } | null)[] | null
			};

			export type MyQuery$input = null;
		`)
	})

	test('query with input', async function () {
		// the document to test
		const doc = mockCollectedDoc(
			`query MyQuery($id: ID!, $enum: MyEnum) { user(id: $id, enumArg: $enum ) { firstName } }`
		)

		// execute the generator
		await runPipeline(config, [doc])

		// look up the files in the artifact directory
		const fileContents = await fs.readFile(config.artifactTypePath(doc.document))

		// make sure they match what we expect
		expect(
			recast.parse(fileContents!, {
				parser: typeScriptParser,
			})
		).toMatchInlineSnapshot(`
			import type { MyEnum } from "$houdini/graphql/enums";

			export type MyQuery = {
			    readonly "input": MyQuery$input
			    readonly "result": MyQuery$result | undefined
			};

			export type MyQuery$result = {
			    readonly user: {
			        readonly firstName: string
			    } | null
			};

			export type MyQuery$input = {
			    id: string
			    enum?: MyEnum | null | undefined
			};
		`)
	})

	test('interface on interface', async function () {
		// the document to test
		const doc = mockCollectedDoc(
			`query MyTestQuery {
				entity {
					... on Node {
						id
					}
				}
			}`
		)

		// execute the generator
		await runPipeline(config, [doc])

		// look up the files in the artifact directory
		const fileContents = await fs.readFile(config.artifactTypePath(doc.document))

		// make sure they match what we expect
		expect(
			recast.parse(fileContents!, {
				parser: typeScriptParser,
			})
		).toMatchInlineSnapshot(`
			export type MyTestQuery = {
			    readonly "input": MyTestQuery$input
			    readonly "result": MyTestQuery$result | undefined
			};

			export type MyTestQuery$result = {
			    readonly entity: {} & (({
			        readonly id: string
			        readonly __typename: "Cat"
			    }) | ({
			        readonly id: string
			        readonly __typename: "User"
			    }))
			};

			export type MyTestQuery$input = null;
		`)
	})

	test('mutation with input list', async function () {
		// the document to test
		const doc = mockCollectedDoc(
			`mutation MyMutation(
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
		const fileContents = await fs.readFile(config.artifactTypePath(doc.document))

		// make sure they match what we expect
		expect(
			recast.parse(fileContents!, {
				parser: typeScriptParser,
			})
		).toMatchInlineSnapshot(`
			import type { MyEnum } from "$houdini/graphql/enums";

			export type MyMutation = {
			    readonly "input": MyMutation$input
			    readonly "result": MyMutation$result
			};

			export type MyMutation$result = {
			    readonly doThing: {
			        readonly firstName: string
			    } | null
			};

			type NestedUserFilter = {
			    id: string
			    firstName: string
			    admin?: boolean | null | undefined
			    age?: number | null | undefined
			    weight?: number | null | undefined
			};

			type UserFilter = {
			    middle?: NestedUserFilter | null | undefined
			    listRequired: (string)[]
			    nullList?: (string | null | undefined)[] | null | undefined
			    recursive?: UserFilter | null | undefined
			    enum?: MyEnum | null | undefined
			};

			export type MyMutation$input = {
			    filter?: UserFilter | null | undefined
			    filterList: (UserFilter)[]
			    id: string
			    firstName: string
			    admin?: boolean | null | undefined
			    age?: number | null | undefined
			    weight?: number | null | undefined
			};

			export type MyMutation$optimistic = {
			    readonly doThing?: {
			        readonly firstName?: string
			    } | null
			};
		`)
	})

	test("mutation optimistic response type doesn't include fragments", async function () {
		// the document to test
		const docs = [
			mockCollectedDoc(
				`mutation MyMutation {
						doThing(
						list: [],
						id: "1"
						firstName: "hello"
					) {
						firstName
						...TestFragment,
					}
				}`
			),
			mockCollectedDoc(
				`fragment TestFragment on User {
					firstName
				}`
			),
		]

		// execute the generator
		await runPipeline(config, docs)

		// look up the files in the artifact directory
		const fileContents = await fs.readFile(config.artifactTypePath(docs[0].document))

		// make sure they match what we expect
		expect(
			recast.parse(fileContents!, {
				parser: typeScriptParser,
			})
		).toMatchInlineSnapshot(`
			export type MyMutation = {
			    readonly "input": MyMutation$input
			    readonly "result": MyMutation$result
			};

			export type MyMutation$result = {
			    readonly doThing: {
			        readonly firstName: string
			        readonly $fragments: {
			            TestFragment: true
			        }
			    } | null
			};

			export type MyMutation$input = null;

			export type MyMutation$optimistic = {
			    readonly doThing?: {
			        readonly firstName?: string
			    } | null
			};
		`)
	})

	test('nested input objects', async function () {
		// the document to test
		const doc = mockCollectedDoc(
			`query MyQuery($filter: UserFilter!) { user(filter: $filter) { firstName } }`
		)

		// execute the generator
		await runPipeline(config, [doc])

		// look up the files in the artifact directory
		const fileContents = await fs.readFile(config.artifactTypePath(doc.document))

		// make sure they match what we expect
		expect(
			recast.parse(fileContents!, {
				parser: typeScriptParser,
			})
		).toMatchInlineSnapshot(`
			import type { MyEnum } from "$houdini/graphql/enums";

			export type MyQuery = {
			    readonly "input": MyQuery$input
			    readonly "result": MyQuery$result | undefined
			};

			export type MyQuery$result = {
			    readonly user: {
			        readonly firstName: string
			    } | null
			};

			type NestedUserFilter = {
			    id: string
			    firstName: string
			    admin?: boolean | null | undefined
			    age?: number | null | undefined
			    weight?: number | null | undefined
			};

			type UserFilter = {
			    middle?: NestedUserFilter | null | undefined
			    listRequired: (string)[]
			    nullList?: (string | null | undefined)[] | null | undefined
			    recursive?: UserFilter | null | undefined
			    enum?: MyEnum | null | undefined
			};

			export type MyQuery$input = {
			    filter: UserFilter
			};
		`)
	})

	test('generates index file', async function () {
		// the document to test
		const doc = mockCollectedDoc(
			`query MyQuery($filter: UserFilter!) { user(filter: $filter) { firstName } }`
		)

		// execute the generator
		await runPipeline(config, [doc])

		// read the type index file
		const fileContents = await fs.readFile(config.typeIndexPath)

		expect(
			recast.parse(fileContents!, {
				parser: typeScriptParser,
			})
		).toMatchInlineSnapshot(`
			export * from "./artifacts/MyQuery";
			export * from "./runtime";
			export * from "./graphql";
		`)
	})

	test('fragment spreads', async function () {
		// the document with the fragment
		const fragment = mockCollectedDoc(`fragment Foo on User { firstName }`)

		// the document to test
		const query = mockCollectedDoc(`query MyQuery { user { ...Foo } }`)

		// execute the generator
		await runPipeline(config, [query, fragment])

		// look up the files in the artifact directory
		const fileContents = await fs.readFile(config.artifactTypePath(query.document))

		// make sure they match what we expect
		expect(
			recast.parse(fileContents!, {
				parser: typeScriptParser,
			})
		).toMatchInlineSnapshot(`
			export type MyQuery = {
			    readonly "input": MyQuery$input
			    readonly "result": MyQuery$result | undefined
			};

			export type MyQuery$result = {
			    readonly user: {
			        readonly $fragments: {
			            Foo: true
			        }
			    } | null
			};

			export type MyQuery$input = null;
		`)
	})

	test('fragment spreads no masking', async function () {
		const withoutMasking = testConfig({ disableMasking: true })

		// the document with the fragment
		const fragment = mockCollectedDoc(`fragment Foo on User { firstName }`)

		// the document to test
		const query = mockCollectedDoc(`query MyQuery { user { ...Foo } }`)

		// execute the generator
		await runPipeline(withoutMasking, [query, fragment])

		// look up the files in the artifact directory
		const fileContents = await fs.readFile(config.artifactTypePath(query.document))

		// make sure they match what we expect
		expect(
			recast.parse(fileContents!, {
				parser: typeScriptParser,
			})
		).toMatchInlineSnapshot(`
			export type MyQuery = {
			    readonly "input": MyQuery$input
			    readonly "result": MyQuery$result | undefined
			};

			export type MyQuery$result = {
			    readonly user: {
			        readonly firstName: string
			        readonly $fragments: {
			            Foo: true
			        }
			    }
			};

			export type MyQuery$input = null;
		`)
	})

	test('interfaces', async function () {
		// the document to test
		const query = mockCollectedDoc(
			`
			query MyQuery {
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
		const fileContents = await fs.readFile(config.artifactTypePath(query.document))

		// make sure they match what we expect
		expect(
			recast.parse(fileContents!, {
				parser: typeScriptParser,
			})
		).toMatchInlineSnapshot(`
			export type MyQuery = {
			    readonly "input": MyQuery$input
			    readonly "result": MyQuery$result | undefined
			};

			export type MyQuery$result = {
			    readonly nodes: ({} & (({
			        readonly id: string
			        readonly __typename: "User"
			    }) | ({
			        readonly id: string
			        readonly __typename: "Cat"
			    })))[]
			};

			export type MyQuery$input = null;
		`)
	})

	test('unions', async function () {
		// the document to test
		const query = mockCollectedDoc(
			`
			query MyQuery {
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
		const fileContents = await fs.readFile(config.artifactTypePath(query.document))

		// make sure they match what we expect
		expect(
			recast.parse(fileContents!, {
				parser: typeScriptParser,
			})
		).toMatchInlineSnapshot(`
			export type MyQuery = {
			    readonly "input": MyQuery$input
			    readonly "result": MyQuery$result | undefined
			};

			export type MyQuery$result = {
			    readonly entities: ({} & (({
			        readonly id: string
			        readonly __typename: "User"
			    }) | ({
			        readonly id: string
			        readonly __typename: "Cat"
			    })) | null)[] | null
			};

			export type MyQuery$input = null;
		`)
	})

	test('discriminated interface', async function () {
		// the document to test
		const query = mockCollectedDoc(
			`
			query MyQuery {
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
		const fileContents = await fs.readFile(config.artifactTypePath(query.document))

		// make sure they match what we expect
		expect(
			recast.parse(fileContents!, {
				parser: typeScriptParser,
			})
		).toMatchInlineSnapshot(`
			export type MyQuery = {
			    readonly "input": MyQuery$input
			    readonly "result": MyQuery$result | undefined
			};

			export type MyQuery$result = {
			    readonly nodes: ({
			        readonly id: string
			    } & (({
			        readonly firstName: string
			        readonly __typename: "User"
			    }) | ({
			        readonly kitty: boolean
			        readonly __typename: "Cat"
			    })))[]
			};

			export type MyQuery$input = null;
		`)
	})

	test('intersecting interface', async function () {
		// the document to test
		const query = mockCollectedDoc(
			`
			query MyQuery {
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
		const fileContents = await fs.readFile(config.artifactTypePath(query.document))

		// make sure they match what we expect
		expect(
			recast.parse(fileContents!, {
				parser: typeScriptParser,
			})
		).toMatchInlineSnapshot(`
			export type MyQuery = {
			    readonly "input": MyQuery$input
			    readonly "result": MyQuery$result | undefined
			};

			export type MyQuery$result = {
			    readonly entities: ({} & (({
			        readonly isAnimal: boolean
			        readonly kitty: boolean
			        readonly __typename: "Cat"
			    }) | ({
			        readonly firstName: string
			        readonly __typename: "User"
			    })) | null)[] | null
			};

			export type MyQuery$input = null;
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
		const query = mockCollectedDoc(`query MyQuery { allItems { createdAt } }`)

		// execute the generator
		await runPipeline(localConfig, [query])

		// look up the files in the artifact directory
		const fileContents = await fs.readFile(config.artifactTypePath(query.document))

		// make sure they match what we expect
		expect(
			recast.parse(fileContents!, {
				parser: typeScriptParser,
			})
		).toMatchInlineSnapshot(`
			export type MyQuery = {
			    readonly "input": MyQuery$input
			    readonly "result": MyQuery$result | undefined
			};

			export type MyQuery$result = {
			    readonly allItems: ({
			        readonly createdAt: Date
			    })[]
			};

			export type MyQuery$input = null;
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
			`query MyQuery($date: DateTime!) { allItems(createdAt: $date) { createdAt } }`
		)

		// execute the generator
		await runPipeline(localConfig, [query])

		// look up the files in the artifact directory
		const fileContents = await fs.readFile(config.artifactTypePath(query.document))

		// make sure they match what we expect
		expect(
			recast.parse(fileContents!, {
				parser: typeScriptParser,
			})
		).toMatchInlineSnapshot(`
			export type MyQuery = {
			    readonly "input": MyQuery$input
			    readonly "result": MyQuery$result | undefined
			};

			export type MyQuery$result = {
			    readonly allItems: ({
			        readonly createdAt: Date
			    })[]
			};

			export type MyQuery$input = {
			    date: Date
			};
		`)
	})

	test('can generate types for list of lists', async function () {
		// the document to test
		const query = mockCollectedDoc(
			`
			query MyQuery {
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
		const fileContents = await fs.readFile(config.artifactTypePath(query.document))

		// make sure they match what we expect
		expect(
			recast.parse(fileContents!, {
				parser: typeScriptParser,
			})
		).toMatchInlineSnapshot(`
			export type MyQuery = {
			    readonly "input": MyQuery$input
			    readonly "result": MyQuery$result | undefined
			};

			export type MyQuery$result = {
			    readonly listOfLists: (({
			        readonly firstName: string
			        readonly nickname: string | null
			    } | null)[] | null)[]
			};

			export type MyQuery$input = null;
		`)
	})

	test('duplicate fields', async function () {
		// the document to test
		const query = mockCollectedDoc(`query MyQuery {
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
		const fileContents = await fs.readFile(config.artifactTypePath(query.document))

		// make sure they match what we expect
		expect(
			recast.parse(fileContents!, {
				parser: typeScriptParser,
			})
		).toMatchInlineSnapshot(`
			export type MyQuery = {
			    readonly "input": MyQuery$input
			    readonly "result": MyQuery$result | undefined
			};

			export type MyQuery$result = {
			    readonly user: {
			        readonly parent: {
			            readonly firstName: string
			            readonly nickname: string | null
			        } | null
			    } | null
			};

			export type MyQuery$input = null;
		`)
	})

	test('can reference list fragments', async function () {
		const unmaskedConfig = testConfig({ disableMasking: true, schema: config.schema })

		// the document to test
		const docs = [
			mockCollectedDoc(`
				query MyQuery {
					users @list(name:"My_Users") {
						id
					}
				}
			`),
			mockCollectedDoc(`
				mutation MyMutation(
					$filter: UserFilter,
					$filterList: [UserFilter!]!,
					$id: ID!
					$firstName: String!
					$admin: Boolean
					$age: Int
					$weight: Float
				) {
					doThing(
						filter: $filter,
						list: $filterList,
						id:$id
						firstName:$firstName
						admin:$admin
						age:$age
						weight:$weight
					) {
						...My_Users_remove
						...My_Users_insert
					}
				}
			`),
		]

		// execute the generator
		await runPipeline(unmaskedConfig, docs)

		// look up the files in the artifact directory
		const fileContents = await fs.readFile(config.artifactTypePath(docs[1].document))

		// make sure they match what we expect
		expect(
			recast.parse(fileContents!, {
				parser: typeScriptParser,
			})
		).toMatchInlineSnapshot(`
			import type { MyEnum } from "$houdini/graphql/enums";

			export type MyMutation = {
			    readonly "input": MyMutation$input
			    readonly "result": MyMutation$result
			};

			export type MyMutation$result = {
			    readonly doThing: {
			        readonly id: string
			        readonly $fragments: {
			            My_Users_remove: true
			            My_Users_insert: true
			        }
			    } | null
			};

			type NestedUserFilter = {
			    id: string
			    firstName: string
			    admin?: boolean | null | undefined
			    age?: number | null | undefined
			    weight?: number | null | undefined
			};

			type UserFilter = {
			    middle?: NestedUserFilter | null | undefined
			    listRequired: (string)[]
			    nullList?: (string | null | undefined)[] | null | undefined
			    recursive?: UserFilter | null | undefined
			    enum?: MyEnum | null | undefined
			};

			export type MyMutation$input = {
			    filter?: UserFilter | null | undefined
			    filterList: (UserFilter)[]
			    id: string
			    firstName: string
			    admin?: boolean | null | undefined
			    age?: number | null | undefined
			    weight?: number | null | undefined
			};

			export type MyMutation$optimistic = {
			    readonly doThing?: {
			        readonly id?: string
			    } | null
			};
		`)
	})

	test('disable default fragment masking', async function () {
		const configWithoutMasking = testConfig({
			disableMasking: true,
			schema: config.schema,
		})

		const docs = [
			mockCollectedDoc(`
				query MyQuery {
					user {
						...UserBase
						...UserMore
					}
				}
			`),
			mockCollectedDoc(`
				fragment UserBase on User {
					id
					firstName
				}
			`),
			mockCollectedDoc(`
				fragment UserMore on User {
					friends {
						...UserBase
					}
				}
			`),
		]

		// execute the generator
		await runPipeline(configWithoutMasking, docs)

		// look up the files in the artifact directory
		const fileContents = await fs.readFile(
			configWithoutMasking.artifactTypePath(docs[0].document)
		)

		// make sure they match what we expect
		expect(
			recast.parse(fileContents!, {
				parser: typeScriptParser,
			})
		).toMatchInlineSnapshot(`
			export type MyQuery = {
			    readonly "input": MyQuery$input
			    readonly "result": MyQuery$result | undefined
			};

			export type MyQuery$result = {
			    readonly user: {
			        readonly id: string
			        readonly firstName: string
			        readonly friends: ({
			            readonly id: string
			            readonly firstName: string
			            readonly $fragments: {
			                UserBase: true
			            }
			        } | null)[] | null
			        readonly $fragments: {
			            UserBase: true
			            UserMore: true
			        }
			    } | null
			};

			export type MyQuery$input = null;
		`)
	})

	test('disable individual fragment masking', async function () {
		const configWithMasking = testConfig({
			disableMasking: false,
			schema: config.schema,
		})

		const docs = [
			mockCollectedDoc(`
				query MyQuery {
					user {
						...UserBase @houdini(mask: false)
						...UserMore
					}
				}
			`),
			mockCollectedDoc(`
				fragment UserBase on User {
					id
					firstName
				}
			`),
			mockCollectedDoc(`
				fragment UserMore on User {
					friends {
						...UserBase
					}
				}
			`),
		]

		// execute the generator
		await runPipeline(configWithMasking, docs)

		// look up the files in the artifact directory
		const [queryFileContents, fragmentFileContents] = await Promise.all([
			fs.readFile(configWithMasking.artifactTypePath(docs[0].document)),
			fs.readFile(configWithMasking.artifactTypePath(docs[2].document)),
		])

		// make sure they match what we expect
		expect(
			recast.parse(queryFileContents!, {
				parser: typeScriptParser,
			})
		).toMatchInlineSnapshot(`
			export type MyQuery = {
			    readonly "input": MyQuery$input
			    readonly "result": MyQuery$result | undefined
			};

			export type MyQuery$result = {
			    readonly user: {
			        readonly id: string
			        readonly firstName: string
			        readonly $fragments: {
			            UserBase: true
			            UserMore: true
			        }
			    } | null
			};

			export type MyQuery$input = null;
		`)

		expect(
			recast.parse(fragmentFileContents!, {
				parser: typeScriptParser,
			})
		).toMatchInlineSnapshot(`
			export type UserMore = {
			    readonly "shape"?: UserMore$data
			    readonly "$fragments": {
			        "UserMore": true
			    }
			};

			export type UserMore$data = {
			    readonly friends: ({
			        readonly $fragments: {
			            UserBase: true
			        }
			    } | null)[] | null
			};
		`)
	})

	test('enable individual fragment masking', async function () {
		const configWithoutMasking = testConfig({
			disableMasking: true,
			schema: config.schema,
		})

		const docs = [
			mockCollectedDoc(`
				query MyQuery {
					user {
						...UserBase @houdini(mask: true)
						...UserMore
					}
				}
			`),
			mockCollectedDoc(`
				fragment UserBase on User {
					id
					firstName
				}
			`),
			mockCollectedDoc(`
				fragment UserMore on User {
					friends {
						...UserBase
					}
				}
			`),
		]

		// execute the generator
		await runPipeline(configWithoutMasking, docs)

		// look up the files in the artifact directory
		const [queryFileContents, fragmentFileContents] = await Promise.all([
			fs.readFile(configWithoutMasking.artifactTypePath(docs[0].document)),
			fs.readFile(configWithoutMasking.artifactTypePath(docs[2].document)),
		])

		// make sure they match what we expect
		expect(
			recast.parse(queryFileContents!, {
				parser: typeScriptParser,
			})
		).toMatchInlineSnapshot(`
			export type MyQuery = {
			    readonly "input": MyQuery$input
			    readonly "result": MyQuery$result | undefined
			};

			export type MyQuery$result = {
			    readonly user: {
			        readonly friends: ({
			            readonly id: string
			            readonly firstName: string
			            readonly $fragments: {
			                UserBase: true
			            }
			        } | null)[] | null
			        readonly $fragments: {
			            UserBase: true
			            UserMore: true
			        }
			    } | null
			};

			export type MyQuery$input = null;
		`)

		expect(
			recast.parse(fragmentFileContents!, {
				parser: typeScriptParser,
			})
		).toMatchInlineSnapshot(`
			export type UserMore = {
			    readonly "shape"?: UserMore$data
			    readonly "$fragments": {
			        "UserMore": true
			    }
			};

			export type UserMore$data = {
			    readonly friends: ({
			        readonly id: string
			        readonly firstName: string
			        readonly $fragments: {
			            UserBase: true
			        }
			    } | null)[] | null
			};
		`)
	})

	test.todo('fragments on interfaces')

	test.todo('intersections with __typename in subselection')

	test.todo('inline fragments')
})
