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
			nickname: String
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
			parentRequired: User!
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
			import type { ValueOf } from "$houdini/runtime/lib/types";
			export type TestFragment$input = {};

			export type TestFragment = {
			    readonly "shape"?: TestFragment$data;
			    readonly " $fragments": {
			        "TestFragment": any;
			    };
			};

			export type TestFragment$data = {
			    readonly firstName: string;
			    readonly nickname: string | null;
			    readonly enumValue: ValueOf<typeof MyEnum> | null;
			};

			export type TestFragment$artifact = {
			    "name": "TestFragment";
			    "kind": "HoudiniFragment";
			    "hash": "fceff6ae64f8fee7acbac56b4832696e9d3c126241ffbe70e47d4ac5cd74a3de";
			    "raw": \`fragment TestFragment on User {
			  firstName
			  nickname
			  enumValue
			  id
			  __typename
			}
			\`;
			    "rootType": "User";
			    "selection": {
			        "fields": {
			            "firstName": {
			                "type": "String";
			                "keyRaw": "firstName";
			                "visible": true;
			            };
			            "nickname": {
			                "type": "String";
			                "keyRaw": "nickname";
			                "nullable": true;
			                "visible": true;
			            };
			            "enumValue": {
			                "type": "MyEnum";
			                "keyRaw": "enumValue";
			                "nullable": true;
			                "visible": true;
			            };
			            "id": {
			                "type": "ID";
			                "keyRaw": "id";
			                "visible": true;
			            };
			            "__typename": {
			                "type": "String";
			                "keyRaw": "__typename";
			                "visible": true;
			            };
			        };
			    };
			    "pluginData": {};
			};
		`)
	})

	test('fragment types with variables', async function () {
		// the document to test
		const doc = mockCollectedDoc(
			`fragment TestFragment on Query @arguments(name:{ type: "ID" }) { user(id: $name) { age } }`
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
			export type TestFragment$input = {
			    name?: string | null | undefined;
			};

			export type TestFragment = {
			    readonly "shape"?: TestFragment$data;
			    readonly " $fragments": {
			        "TestFragment": any;
			    };
			};

			export type TestFragment$data = {
			    readonly user: {
			        readonly age: number | null;
			    } | null;
			};

			export type TestFragment$artifact = {
			    "name": "TestFragment";
			    "kind": "HoudiniFragment";
			    "hash": "a78cd6407bf767a7a049685ac6d33ff81a49a349895c87e2cd796ff47802c339";
			    "raw": \`fragment TestFragment on Query {
			  user(id: $name) {
			    age
			    id
			  }
			  __typename
			}
			\`;
			    "rootType": "Query";
			    "selection": {
			        "fields": {
			            "user": {
			                "type": "User";
			                "keyRaw": "user(id: $name)";
			                "nullable": true;
			                "selection": {
			                    "fields": {
			                        "age": {
			                            "type": "Int";
			                            "keyRaw": "age";
			                            "nullable": true;
			                            "visible": true;
			                        };
			                        "id": {
			                            "type": "ID";
			                            "keyRaw": "id";
			                            "visible": true;
			                        };
			                    };
			                };
			                "visible": true;
			            };
			            "__typename": {
			                "type": "String";
			                "keyRaw": "__typename";
			                "visible": true;
			            };
			        };
			    };
			    "pluginData": {};
			    "input": {
			        "fields": {
			            "name": "ID";
			        };
			        "types": {};
			    };
			};
		`)
	})

	test('fragment types with required variables', async function () {
		// the document to test
		const doc = mockCollectedDoc(
			`fragment TestFragment on Query @arguments(name:{ type: "ID!" }) { user(id: $name) { age } }`
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
			export type TestFragment$input = {
			    name: string;
			};

			export type TestFragment = {
			    readonly "shape"?: TestFragment$data;
			    readonly " $fragments": {
			        "TestFragment": any;
			    };
			};

			export type TestFragment$data = {
			    readonly user: {
			        readonly age: number | null;
			    } | null;
			};

			export type TestFragment$artifact = {
			    "name": "TestFragment";
			    "kind": "HoudiniFragment";
			    "hash": "a78cd6407bf767a7a049685ac6d33ff81a49a349895c87e2cd796ff47802c339";
			    "raw": \`fragment TestFragment on Query {
			  user(id: $name) {
			    age
			    id
			  }
			  __typename
			}
			\`;
			    "rootType": "Query";
			    "selection": {
			        "fields": {
			            "user": {
			                "type": "User";
			                "keyRaw": "user(id: $name)";
			                "nullable": true;
			                "selection": {
			                    "fields": {
			                        "age": {
			                            "type": "Int";
			                            "keyRaw": "age";
			                            "nullable": true;
			                            "visible": true;
			                        };
			                        "id": {
			                            "type": "ID";
			                            "keyRaw": "id";
			                            "visible": true;
			                        };
			                    };
			                };
			                "visible": true;
			            };
			            "__typename": {
			                "type": "String";
			                "keyRaw": "__typename";
			                "visible": true;
			            };
			        };
			    };
			    "pluginData": {};
			    "input": {
			        "fields": {
			            "name": "ID";
			        };
			        "types": {};
			    };
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
			export type TestFragment$input = {};

			export type TestFragment = {
			    readonly "shape"?: TestFragment$data;
			    readonly " $fragments": {
			        "TestFragment": any;
			    };
			};

			export type TestFragment$data = {
			    readonly firstName: string;
			    readonly parent: {
			        readonly firstName: string;
			    } | null;
			};

			export type TestFragment$artifact = {
			    "name": "TestFragment";
			    "kind": "HoudiniFragment";
			    "hash": "5d680d18e72a984f24a8ef0d2703ef8ce34ca0ee7abe3d171a31f3565c47f236";
			    "raw": \`fragment TestFragment on User {
			  firstName
			  parent {
			    firstName
			    id
			  }
			  id
			  __typename
			}
			\`;
			    "rootType": "User";
			    "selection": {
			        "fields": {
			            "firstName": {
			                "type": "String";
			                "keyRaw": "firstName";
			                "visible": true;
			            };
			            "parent": {
			                "type": "User";
			                "keyRaw": "parent";
			                "nullable": true;
			                "selection": {
			                    "fields": {
			                        "firstName": {
			                            "type": "String";
			                            "keyRaw": "firstName";
			                            "visible": true;
			                        };
			                        "id": {
			                            "type": "ID";
			                            "keyRaw": "id";
			                            "visible": true;
			                        };
			                    };
			                };
			                "visible": true;
			            };
			            "id": {
			                "type": "ID";
			                "keyRaw": "id";
			                "visible": true;
			            };
			            "__typename": {
			                "type": "String";
			                "keyRaw": "__typename";
			                "visible": true;
			            };
			        };
			    };
			    "pluginData": {};
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
			export type TestFragment$input = {};

			export type TestFragment = {
			    readonly "shape"?: TestFragment$data;
			    readonly " $fragments": {
			        "TestFragment": any;
			    };
			};

			export type TestFragment$data = {
			    readonly firstName: string;
			    readonly admin: boolean | null;
			    readonly age: number | null;
			    readonly id: string;
			    readonly weight: number | null;
			};

			export type TestFragment$artifact = {
			    "name": "TestFragment";
			    "kind": "HoudiniFragment";
			    "hash": "1a2c7e3a724ee77d1d482d538bb55515044050ab8d95e6e555d427e197e00132";
			    "raw": \`fragment TestFragment on User {
			  firstName
			  admin
			  age
			  id
			  weight
			  __typename
			}
			\`;
			    "rootType": "User";
			    "selection": {
			        "fields": {
			            "firstName": {
			                "type": "String";
			                "keyRaw": "firstName";
			                "visible": true;
			            };
			            "admin": {
			                "type": "Boolean";
			                "keyRaw": "admin";
			                "nullable": true;
			                "visible": true;
			            };
			            "age": {
			                "type": "Int";
			                "keyRaw": "age";
			                "nullable": true;
			                "visible": true;
			            };
			            "id": {
			                "type": "ID";
			                "keyRaw": "id";
			                "visible": true;
			            };
			            "weight": {
			                "type": "Float";
			                "keyRaw": "weight";
			                "nullable": true;
			                "visible": true;
			            };
			            "__typename": {
			                "type": "String";
			                "keyRaw": "__typename";
			                "visible": true;
			            };
			        };
			    };
			    "pluginData": {};
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
			export type TestFragment$input = {};

			export type TestFragment = {
			    readonly "shape"?: TestFragment$data;
			    readonly " $fragments": {
			        "TestFragment": any;
			    };
			};

			export type TestFragment$data = {
			    readonly firstName: string;
			    readonly friends: ({
			        readonly firstName: string;
			    } | null)[] | null;
			};

			export type TestFragment$artifact = {
			    "name": "TestFragment";
			    "kind": "HoudiniFragment";
			    "hash": "684384697e73211447233755a41be7ac8628045b117eba9629f9ca71ab27c233";
			    "raw": \`fragment TestFragment on User {
			  firstName
			  friends {
			    firstName
			    id
			  }
			  id
			  __typename
			}
			\`;
			    "rootType": "User";
			    "selection": {
			        "fields": {
			            "firstName": {
			                "type": "String";
			                "keyRaw": "firstName";
			                "visible": true;
			            };
			            "friends": {
			                "type": "User";
			                "keyRaw": "friends";
			                "nullable": true;
			                "selection": {
			                    "fields": {
			                        "firstName": {
			                            "type": "String";
			                            "keyRaw": "firstName";
			                            "visible": true;
			                        };
			                        "id": {
			                            "type": "ID";
			                            "keyRaw": "id";
			                            "visible": true;
			                        };
			                    };
			                };
			                "visible": true;
			            };
			            "id": {
			                "type": "ID";
			                "keyRaw": "id";
			                "visible": true;
			            };
			            "__typename": {
			                "type": "String";
			                "keyRaw": "__typename";
			                "visible": true;
			            };
			        };
			    };
			    "pluginData": {};
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
			    readonly "input": MyQuery$input;
			    readonly "result": MyQuery$result | undefined;
			};

			export type MyQuery$result = {
			    readonly user: {
			        readonly firstName: string;
			    } | null;
			};

			export type MyQuery$input = null;

			export type MyQuery$artifact = {
			    "name": "MyQuery";
			    "kind": "HoudiniQuery";
			    "hash": "625c21946a71940431e5e1d11e48ea22ecb230839628cb66903198444a2f707d";
			    "raw": \`query MyQuery {
			  user {
			    firstName
			    id
			  }
			}
			\`;
			    "rootType": "Query";
			    "selection": {
			        "fields": {
			            "user": {
			                "type": "User";
			                "keyRaw": "user";
			                "nullable": true;
			                "selection": {
			                    "fields": {
			                        "firstName": {
			                            "type": "String";
			                            "keyRaw": "firstName";
			                            "visible": true;
			                        };
			                        "id": {
			                            "type": "ID";
			                            "keyRaw": "id";
			                            "visible": true;
			                        };
			                    };
			                };
			                "visible": true;
			            };
			        };
			    };
			    "pluginData": {};
			    "policy": "CacheOrNetwork";
			    "partial": false;
			};
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
			    readonly "input": MyQuery$input;
			    readonly "result": MyQuery$result | undefined;
			};

			export type MyQuery$result = {
			    readonly users: ({
			        readonly firstName: string;
			    } | null)[] | null;
			};

			export type MyQuery$input = null;

			export type MyQuery$artifact = {
			    "name": "MyQuery";
			    "kind": "HoudiniQuery";
			    "hash": "6e6ba167260c6f741547299697b6d32fd3b071e1c2cab13adbb7e08c60c1c175";
			    "raw": \`query MyQuery {
			  users {
			    firstName
			    id
			  }
			}
			\`;
			    "rootType": "Query";
			    "selection": {
			        "fields": {
			            "users": {
			                "type": "User";
			                "keyRaw": "users";
			                "nullable": true;
			                "selection": {
			                    "fields": {
			                        "firstName": {
			                            "type": "String";
			                            "keyRaw": "firstName";
			                            "visible": true;
			                        };
			                        "id": {
			                            "type": "ID";
			                            "keyRaw": "id";
			                            "visible": true;
			                        };
			                    };
			                };
			                "visible": true;
			            };
			        };
			    };
			    "pluginData": {};
			    "policy": "CacheOrNetwork";
			    "partial": false;
			};
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
			import type { ValueOf } from "$houdini/runtime/lib/types";
			import type { MyEnum } from "$houdini/graphql/enums";

			export type MyQuery = {
			    readonly "input": MyQuery$input;
			    readonly "result": MyQuery$result | undefined;
			};

			export type MyQuery$result = {
			    readonly user: {
			        readonly firstName: string;
			    } | null;
			};

			export type MyQuery$input = {
			    id: string;
			    enum?: ValueOf<typeof MyEnum> | null | undefined;
			};

			export type MyQuery$artifact = {
			    "name": "MyQuery";
			    "kind": "HoudiniQuery";
			    "hash": "41cbf2714e1b1f0786226f6d9b68be0873e46fe5ffd7d3c08ad7fd338feeacbd";
			    "raw": \`query MyQuery($id: ID!, $enum: MyEnum) {
			  user(id: $id, enumArg: $enum) {
			    firstName
			    id
			  }
			}
			\`;
			    "rootType": "Query";
			    "selection": {
			        "fields": {
			            "user": {
			                "type": "User";
			                "keyRaw": "user(enumArg: $enum, id: $id)";
			                "nullable": true;
			                "selection": {
			                    "fields": {
			                        "firstName": {
			                            "type": "String";
			                            "keyRaw": "firstName";
			                            "visible": true;
			                        };
			                        "id": {
			                            "type": "ID";
			                            "keyRaw": "id";
			                            "visible": true;
			                        };
			                    };
			                };
			                "visible": true;
			            };
			        };
			    };
			    "pluginData": {};
			    "input": {
			        "fields": {
			            "id": "ID";
			            "enum": "MyEnum";
			        };
			        "types": {};
			    };
			    "policy": "CacheOrNetwork";
			    "partial": false;
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
			    readonly "input": MyTestQuery$input;
			    readonly "result": MyTestQuery$result | undefined;
			};

			export type MyTestQuery$result = {
			    readonly entity: {} & (({
			        readonly id: string;
			        readonly __typename: "Cat";
			    }) | ({
			        readonly id: string;
			        readonly __typename: "User";
			    }));
			};

			export type MyTestQuery$input = null;

			export type MyTestQuery$artifact = {
			    "name": "MyTestQuery";
			    "kind": "HoudiniQuery";
			    "hash": "dab188c31e4d7e6f47afd6ddf9b0d38cbe4ff49d830c994e5ddcbb315520c59d";
			    "raw": \`query MyTestQuery {
			  entity {
			    ... on Node {
			      id
			    }
			    __typename
			  }
			}
			\`;
			    "rootType": "Query";
			    "selection": {
			        "fields": {
			            "entity": {
			                "type": "Entity";
			                "keyRaw": "entity";
			                "selection": {
			                    "abstractFields": {
			                        "fields": {
			                            "Node": {
			                                "id": {
			                                    "type": "ID";
			                                    "keyRaw": "id";
			                                    "visible": true;
			                                };
			                                "__typename": {
			                                    "type": "String";
			                                    "keyRaw": "__typename";
			                                    "visible": true;
			                                };
			                            };
			                        };
			                        "typeMap": {
			                            "User": "Node";
			                            "Cat": "Node";
			                        };
			                    };
			                    "fields": {
			                        "__typename": {
			                            "type": "String";
			                            "keyRaw": "__typename";
			                            "visible": true;
			                        };
			                    };
			                };
			                "abstract": true;
			                "visible": true;
			            };
			        };
			    };
			    "pluginData": {};
			    "policy": "CacheOrNetwork";
			    "partial": false;
			};
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
			import type { ValueOf } from "$houdini/runtime/lib/types";
			import type { MyEnum } from "$houdini/graphql/enums";

			export type MyMutation = {
			    readonly "input": MyMutation$input;
			    readonly "result": MyMutation$result;
			};

			export type MyMutation$result = {
			    readonly doThing: {
			        readonly firstName: string;
			    } | null;
			};

			type NestedUserFilter = {
			    id: string;
			    firstName: string;
			    admin?: boolean | null | undefined;
			    age?: number | null | undefined;
			    weight?: number | null | undefined;
			};

			type UserFilter = {
			    middle?: NestedUserFilter | null | undefined;
			    listRequired: (string)[];
			    nullList?: (string | null | undefined)[] | null | undefined;
			    recursive?: UserFilter | null | undefined;
			    enum?: ValueOf<typeof MyEnum> | null | undefined;
			};

			export type MyMutation$input = {
			    filter?: UserFilter | null | undefined;
			    filterList: (UserFilter)[];
			    id: string;
			    firstName: string;
			    admin?: boolean | null | undefined;
			    age?: number | null | undefined;
			    weight?: number | null | undefined;
			};

			export type MyMutation$optimistic = {
			    readonly doThing?: {
			        readonly firstName?: string;
			    } | null;
			};

			export type MyMutation$artifact = {
			    "name": "MyMutation";
			    "kind": "HoudiniMutation";
			    "hash": "26def2427df939fd86e8dc0c4b0ebb0904e32dd27a559eac7774dbe5f6a4de7b";
			    "raw": \`mutation MyMutation($filter: UserFilter, $filterList: [UserFilter!]!, $id: ID!, $firstName: String!, $admin: Boolean, $age: Int, $weight: Float) {
			  doThing(
			    filter: $filter
			    list: $filterList
			    id: $id
			    firstName: $firstName
			    admin: $admin
			    age: $age
			    weight: $weight
			  ) {
			    firstName
			    id
			  }
			}
			\`;
			    "rootType": "Mutation";
			    "selection": {
			        "fields": {
			            "doThing": {
			                "type": "User";
			                "keyRaw": "doThing(admin: $admin, age: $age, filter: $filter, firstName: $firstName, id: $id, list: $filterList, weight: $weight)";
			                "nullable": true;
			                "selection": {
			                    "fields": {
			                        "firstName": {
			                            "type": "String";
			                            "keyRaw": "firstName";
			                            "visible": true;
			                        };
			                        "id": {
			                            "type": "ID";
			                            "keyRaw": "id";
			                            "visible": true;
			                        };
			                    };
			                };
			                "visible": true;
			            };
			        };
			    };
			    "pluginData": {};
			    "input": {
			        "fields": {
			            "filter": "UserFilter";
			            "filterList": "UserFilter";
			            "id": "ID";
			            "firstName": "String";
			            "admin": "Boolean";
			            "age": "Int";
			            "weight": "Float";
			        };
			        "types": {
			            "NestedUserFilter": {
			                "id": "ID";
			                "firstName": "String";
			                "admin": "Boolean";
			                "age": "Int";
			                "weight": "Float";
			            };
			            "UserFilter": {
			                "middle": "NestedUserFilter";
			                "listRequired": "String";
			                "nullList": "String";
			                "recursive": "UserFilter";
			                "enum": "MyEnum";
			            };
			        };
			    };
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
			    readonly "input": MyMutation$input;
			    readonly "result": MyMutation$result;
			};

			export type MyMutation$result = {
			    readonly doThing: {
			        readonly firstName: string;
			        readonly " $fragments": {
			            TestFragment: {};
			        };
			    } | null;
			};

			export type MyMutation$input = null;

			export type MyMutation$optimistic = {
			    readonly doThing?: {
			        readonly firstName?: string;
			    } | null;
			};

			export type MyMutation$artifact = {
			    "name": "MyMutation";
			    "kind": "HoudiniMutation";
			    "hash": "6afad439e9a1f5609430b141c04e5d6a0cf91b6360d5f240d83a0d8667b521b6";
			    "raw": \`mutation MyMutation {
			  doThing(list: [], id: "1", firstName: "hello") {
			    firstName
			    ...TestFragment
			    id
			  }
			}

			fragment TestFragment on User {
			  firstName
			  id
			  __typename
			}
			\`;
			    "rootType": "Mutation";
			    "selection": {
			        "fields": {
			            "doThing": {
			                "type": "User";
			                "keyRaw": "doThing(firstName: \\"hello\\", id: \\"1\\", list: [])";
			                "nullable": true;
			                "selection": {
			                    "fields": {
			                        "firstName": {
			                            "type": "String";
			                            "keyRaw": "firstName";
			                            "visible": true;
			                        };
			                        "id": {
			                            "type": "ID";
			                            "keyRaw": "id";
			                            "visible": true;
			                        };
			                        "__typename": {
			                            "type": "String";
			                            "keyRaw": "__typename";
			                        };
			                    };
			                    "fragments": {
			                        "TestFragment": {
			                            "arguments": {};
			                        };
			                    };
			                };
			                "visible": true;
			            };
			        };
			    };
			    "pluginData": {};
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
			import type { ValueOf } from "$houdini/runtime/lib/types";
			import type { MyEnum } from "$houdini/graphql/enums";

			export type MyQuery = {
			    readonly "input": MyQuery$input;
			    readonly "result": MyQuery$result | undefined;
			};

			export type MyQuery$result = {
			    readonly user: {
			        readonly firstName: string;
			    } | null;
			};

			type NestedUserFilter = {
			    id: string;
			    firstName: string;
			    admin?: boolean | null | undefined;
			    age?: number | null | undefined;
			    weight?: number | null | undefined;
			};

			type UserFilter = {
			    middle?: NestedUserFilter | null | undefined;
			    listRequired: (string)[];
			    nullList?: (string | null | undefined)[] | null | undefined;
			    recursive?: UserFilter | null | undefined;
			    enum?: ValueOf<typeof MyEnum> | null | undefined;
			};

			export type MyQuery$input = {
			    filter: UserFilter;
			};

			export type MyQuery$artifact = {
			    "name": "MyQuery";
			    "kind": "HoudiniQuery";
			    "hash": "fe11f3b4897f5da3f4cdc38cfe353c575d071d694e78ccbd26a10b1e6eb3a8e1";
			    "raw": \`query MyQuery($filter: UserFilter!) {
			  user(filter: $filter) {
			    firstName
			    id
			  }
			}
			\`;
			    "rootType": "Query";
			    "selection": {
			        "fields": {
			            "user": {
			                "type": "User";
			                "keyRaw": "user(filter: $filter)";
			                "nullable": true;
			                "selection": {
			                    "fields": {
			                        "firstName": {
			                            "type": "String";
			                            "keyRaw": "firstName";
			                            "visible": true;
			                        };
			                        "id": {
			                            "type": "ID";
			                            "keyRaw": "id";
			                            "visible": true;
			                        };
			                    };
			                };
			                "visible": true;
			            };
			        };
			    };
			    "pluginData": {};
			    "input": {
			        "fields": {
			            "filter": "UserFilter";
			        };
			        "types": {
			            "NestedUserFilter": {
			                "id": "ID";
			                "firstName": "String";
			                "admin": "Boolean";
			                "age": "Int";
			                "weight": "Float";
			            };
			            "UserFilter": {
			                "middle": "NestedUserFilter";
			                "listRequired": "String";
			                "nullList": "String";
			                "recursive": "UserFilter";
			                "enum": "MyEnum";
			            };
			        };
			    };
			    "policy": "CacheOrNetwork";
			    "partial": false;
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
			    readonly "input": MyQuery$input;
			    readonly "result": MyQuery$result | undefined;
			};

			export type MyQuery$result = {
			    readonly user: {
			        readonly " $fragments": {
			            Foo: {};
			        };
			    } | null;
			};

			export type MyQuery$input = null;

			export type MyQuery$artifact = {
			    "name": "MyQuery";
			    "kind": "HoudiniQuery";
			    "hash": "2cc1c9e7df7c0a7fadb2f81f23bbc78211e7ae0adc217320b5fb47a66449fa09";
			    "raw": \`query MyQuery {
			  user {
			    ...Foo
			    id
			  }
			}

			fragment Foo on User {
			  firstName
			  id
			  __typename
			}
			\`;
			    "rootType": "Query";
			    "selection": {
			        "fields": {
			            "user": {
			                "type": "User";
			                "keyRaw": "user";
			                "nullable": true;
			                "selection": {
			                    "fields": {
			                        "firstName": {
			                            "type": "String";
			                            "keyRaw": "firstName";
			                        };
			                        "id": {
			                            "type": "ID";
			                            "keyRaw": "id";
			                            "visible": true;
			                        };
			                        "__typename": {
			                            "type": "String";
			                            "keyRaw": "__typename";
			                        };
			                    };
			                    "fragments": {
			                        "Foo": {
			                            "arguments": {};
			                        };
			                    };
			                };
			                "visible": true;
			            };
			        };
			    };
			    "pluginData": {};
			    "policy": "CacheOrNetwork";
			    "partial": false;
			};
		`)
	})

	test('fragment spreads no masking', async function () {
		const withoutMasking = testConfig({ defaultFragmentMasking: 'disable' })

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
			    readonly "input": MyQuery$input;
			    readonly "result": MyQuery$result | undefined;
			};

			export type MyQuery$result = {
			    readonly user: {
			        readonly firstName: string;
			        readonly " $fragments": {
			            Foo: {};
			        };
			    };
			};

			export type MyQuery$input = null;

			export type MyQuery$artifact = {
			    "name": "MyQuery";
			    "kind": "HoudiniQuery";
			    "hash": "2cc1c9e7df7c0a7fadb2f81f23bbc78211e7ae0adc217320b5fb47a66449fa09";
			    "raw": \`query MyQuery {
			  user {
			    ...Foo
			    id
			  }
			}

			fragment Foo on User {
			  firstName
			  id
			  __typename
			}
			\`;
			    "rootType": "Query";
			    "selection": {
			        "fields": {
			            "user": {
			                "type": "User";
			                "keyRaw": "user";
			                "selection": {
			                    "fields": {
			                        "firstName": {
			                            "type": "String";
			                            "keyRaw": "firstName";
			                            "visible": true;
			                        };
			                        "id": {
			                            "type": "ID";
			                            "keyRaw": "id";
			                            "visible": true;
			                        };
			                        "__typename": {
			                            "type": "String";
			                            "keyRaw": "__typename";
			                            "visible": true;
			                        };
			                    };
			                    "fragments": {
			                        "Foo": {
			                            "arguments": {};
			                        };
			                    };
			                };
			                "visible": true;
			            };
			        };
			    };
			    "pluginData": {};
			    "policy": "CacheOrNetwork";
			    "partial": false;
			};
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
			    readonly "input": MyQuery$input;
			    readonly "result": MyQuery$result | undefined;
			};

			export type MyQuery$result = {
			    readonly nodes: ({} & (({
			        readonly id: string;
			        readonly __typename: "User";
			    }) | ({
			        readonly id: string;
			        readonly __typename: "Cat";
			    }) | ({
			        readonly __typename: "non-exhaustive; don't match this";
			    })))[];
			};

			export type MyQuery$input = null;

			export type MyQuery$artifact = {
			    "name": "MyQuery";
			    "kind": "HoudiniQuery";
			    "hash": "f05dbc7de056c210dcd036ad418cd8ce1060b1c4d4600a96110773ee6b61eb3d";
			    "raw": \`query MyQuery {
			  nodes {
			    ... on User {
			      id
			    }
			    ... on Cat {
			      id
			    }
			    id
			    __typename
			  }
			}
			\`;
			    "rootType": "Query";
			    "selection": {
			        "fields": {
			            "nodes": {
			                "type": "Node";
			                "keyRaw": "nodes";
			                "selection": {
			                    "abstractFields": {
			                        "fields": {
			                            "User": {
			                                "id": {
			                                    "type": "ID";
			                                    "keyRaw": "id";
			                                    "visible": true;
			                                };
			                                "__typename": {
			                                    "type": "String";
			                                    "keyRaw": "__typename";
			                                    "visible": true;
			                                };
			                            };
			                            "Cat": {
			                                "id": {
			                                    "type": "ID";
			                                    "keyRaw": "id";
			                                    "visible": true;
			                                };
			                                "__typename": {
			                                    "type": "String";
			                                    "keyRaw": "__typename";
			                                    "visible": true;
			                                };
			                            };
			                        };
			                        "typeMap": {};
			                    };
			                    "fields": {
			                        "id": {
			                            "type": "ID";
			                            "keyRaw": "id";
			                            "visible": true;
			                        };
			                        "__typename": {
			                            "type": "String";
			                            "keyRaw": "__typename";
			                            "visible": true;
			                        };
			                    };
			                };
			                "abstract": true;
			                "visible": true;
			            };
			        };
			    };
			    "pluginData": {};
			    "policy": "CacheOrNetwork";
			    "partial": false;
			};
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
			    readonly "input": MyQuery$input;
			    readonly "result": MyQuery$result | undefined;
			};

			export type MyQuery$result = {
			    readonly entities: ({} & (({
			        readonly id: string;
			        readonly __typename: "User";
			    }) | ({
			        readonly id: string;
			        readonly __typename: "Cat";
			    })) | null)[] | null;
			};

			export type MyQuery$input = null;

			export type MyQuery$artifact = {
			    "name": "MyQuery";
			    "kind": "HoudiniQuery";
			    "hash": "0bd8237c10df755d9ea5dbc3ed500e19ead68f43d13d50444439ac3bbb17bba4";
			    "raw": \`query MyQuery {
			  entities {
			    ... on User {
			      id
			    }
			    ... on Cat {
			      id
			    }
			    __typename
			  }
			}
			\`;
			    "rootType": "Query";
			    "selection": {
			        "fields": {
			            "entities": {
			                "type": "Entity";
			                "keyRaw": "entities";
			                "nullable": true;
			                "selection": {
			                    "abstractFields": {
			                        "fields": {
			                            "User": {
			                                "id": {
			                                    "type": "ID";
			                                    "keyRaw": "id";
			                                    "visible": true;
			                                };
			                                "__typename": {
			                                    "type": "String";
			                                    "keyRaw": "__typename";
			                                    "visible": true;
			                                };
			                            };
			                            "Cat": {
			                                "id": {
			                                    "type": "ID";
			                                    "keyRaw": "id";
			                                    "visible": true;
			                                };
			                                "__typename": {
			                                    "type": "String";
			                                    "keyRaw": "__typename";
			                                    "visible": true;
			                                };
			                            };
			                        };
			                        "typeMap": {};
			                    };
			                    "fields": {
			                        "__typename": {
			                            "type": "String";
			                            "keyRaw": "__typename";
			                            "visible": true;
			                        };
			                    };
			                };
			                "abstract": true;
			                "visible": true;
			            };
			        };
			    };
			    "pluginData": {};
			    "policy": "CacheOrNetwork";
			    "partial": false;
			};
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
			    readonly "input": MyQuery$input;
			    readonly "result": MyQuery$result | undefined;
			};

			export type MyQuery$result = {
			    readonly nodes: ({
			        readonly id: string;
			    } & (({
			        readonly firstName: string;
			        readonly __typename: "User";
			    }) | ({
			        readonly kitty: boolean;
			        readonly __typename: "Cat";
			    }) | ({
			        readonly __typename: "non-exhaustive; don't match this";
			    })))[];
			};

			export type MyQuery$input = null;

			export type MyQuery$artifact = {
			    "name": "MyQuery";
			    "kind": "HoudiniQuery";
			    "hash": "5ae658318d3b5025d17399231eec2b74785200f653dd4101ae36c019d025dab0";
			    "raw": \`query MyQuery {
			  nodes {
			    id
			    ... on User {
			      firstName
			      id
			    }
			    ... on Cat {
			      kitty
			      id
			    }
			    __typename
			  }
			}
			\`;
			    "rootType": "Query";
			    "selection": {
			        "fields": {
			            "nodes": {
			                "type": "Node";
			                "keyRaw": "nodes";
			                "selection": {
			                    "abstractFields": {
			                        "fields": {
			                            "User": {
			                                "firstName": {
			                                    "type": "String";
			                                    "keyRaw": "firstName";
			                                    "visible": true;
			                                };
			                                "id": {
			                                    "type": "ID";
			                                    "keyRaw": "id";
			                                    "visible": true;
			                                };
			                                "__typename": {
			                                    "type": "String";
			                                    "keyRaw": "__typename";
			                                    "visible": true;
			                                };
			                            };
			                            "Cat": {
			                                "kitty": {
			                                    "type": "Boolean";
			                                    "keyRaw": "kitty";
			                                    "visible": true;
			                                };
			                                "id": {
			                                    "type": "ID";
			                                    "keyRaw": "id";
			                                    "visible": true;
			                                };
			                                "__typename": {
			                                    "type": "String";
			                                    "keyRaw": "__typename";
			                                    "visible": true;
			                                };
			                            };
			                        };
			                        "typeMap": {};
			                    };
			                    "fields": {
			                        "id": {
			                            "type": "ID";
			                            "keyRaw": "id";
			                            "visible": true;
			                        };
			                        "__typename": {
			                            "type": "String";
			                            "keyRaw": "__typename";
			                            "visible": true;
			                        };
			                    };
			                };
			                "abstract": true;
			                "visible": true;
			            };
			        };
			    };
			    "pluginData": {};
			    "policy": "CacheOrNetwork";
			    "partial": false;
			};
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
			    readonly "input": MyQuery$input;
			    readonly "result": MyQuery$result | undefined;
			};

			export type MyQuery$result = {
			    readonly entities: ({} & (({
			        readonly isAnimal: boolean;
			        readonly kitty: boolean;
			        readonly __typename: "Cat";
			    }) | ({
			        readonly firstName: string;
			        readonly __typename: "User";
			    })) | null)[] | null;
			};

			export type MyQuery$input = null;

			export type MyQuery$artifact = {
			    "name": "MyQuery";
			    "kind": "HoudiniQuery";
			    "hash": "05e98237e913172753be67c393d1b8c1257f7442f5a29935232ce1dfed733c4c";
			    "raw": \`query MyQuery {
			  entities {
			    ... on Animal {
			      isAnimal
			    }
			    ... on User {
			      firstName
			      id
			    }
			    ... on Cat {
			      kitty
			      id
			    }
			    __typename
			  }
			}
			\`;
			    "rootType": "Query";
			    "selection": {
			        "fields": {
			            "entities": {
			                "type": "Entity";
			                "keyRaw": "entities";
			                "nullable": true;
			                "selection": {
			                    "abstractFields": {
			                        "fields": {
			                            "User": {
			                                "firstName": {
			                                    "type": "String";
			                                    "keyRaw": "firstName";
			                                    "visible": true;
			                                };
			                                "id": {
			                                    "type": "ID";
			                                    "keyRaw": "id";
			                                    "visible": true;
			                                };
			                                "__typename": {
			                                    "type": "String";
			                                    "keyRaw": "__typename";
			                                    "visible": true;
			                                };
			                            };
			                            "Cat": {
			                                "isAnimal": {
			                                    "type": "Boolean";
			                                    "keyRaw": "isAnimal";
			                                    "visible": true;
			                                };
			                                "kitty": {
			                                    "type": "Boolean";
			                                    "keyRaw": "kitty";
			                                    "visible": true;
			                                };
			                                "id": {
			                                    "type": "ID";
			                                    "keyRaw": "id";
			                                    "visible": true;
			                                };
			                                "__typename": {
			                                    "type": "String";
			                                    "keyRaw": "__typename";
			                                    "visible": true;
			                                };
			                            };
			                        };
			                        "typeMap": {};
			                    };
			                    "fields": {
			                        "__typename": {
			                            "type": "String";
			                            "keyRaw": "__typename";
			                            "visible": true;
			                        };
			                    };
			                };
			                "abstract": true;
			                "visible": true;
			            };
			        };
			    };
			    "pluginData": {};
			    "policy": "CacheOrNetwork";
			    "partial": false;
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
			    readonly "input": MyQuery$input;
			    readonly "result": MyQuery$result | undefined;
			};

			export type MyQuery$result = {
			    readonly allItems: ({
			        readonly createdAt: Date;
			    })[];
			};

			export type MyQuery$input = null;

			export type MyQuery$artifact = {
			    "name": "MyQuery";
			    "kind": "HoudiniQuery";
			    "hash": "5a9bbd198f3c6a0f203b79d3fa07af7a395e82a03cd2046e1da740ff4eb1356a";
			    "raw": \`query MyQuery {
			  allItems {
			    createdAt
			  }
			}
			\`;
			    "rootType": "Query";
			    "selection": {
			        "fields": {
			            "allItems": {
			                "type": "TodoItem";
			                "keyRaw": "allItems";
			                "selection": {
			                    "fields": {
			                        "createdAt": {
			                            "type": "DateTime";
			                            "keyRaw": "createdAt";
			                            "visible": true;
			                        };
			                    };
			                };
			                "visible": true;
			            };
			        };
			    };
			    "pluginData": {};
			    "policy": "CacheOrNetwork";
			    "partial": false;
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
			    readonly "input": MyQuery$input;
			    readonly "result": MyQuery$result | undefined;
			};

			export type MyQuery$result = {
			    readonly allItems: ({
			        readonly createdAt: Date;
			    })[];
			};

			export type MyQuery$input = {
			    date: Date;
			};

			export type MyQuery$artifact = {
			    "name": "MyQuery";
			    "kind": "HoudiniQuery";
			    "hash": "c833b9ebd6847037d2435dcb03ebd7439d8e3a1e749ac242a530d589e9e2e0a1";
			    "raw": \`query MyQuery($date: DateTime!) {
			  allItems(createdAt: $date) {
			    createdAt
			  }
			}
			\`;
			    "rootType": "Query";
			    "selection": {
			        "fields": {
			            "allItems": {
			                "type": "TodoItem";
			                "keyRaw": "allItems(createdAt: $date)";
			                "selection": {
			                    "fields": {
			                        "createdAt": {
			                            "type": "DateTime";
			                            "keyRaw": "createdAt";
			                            "visible": true;
			                        };
			                    };
			                };
			                "visible": true;
			            };
			        };
			    };
			    "pluginData": {};
			    "input": {
			        "fields": {
			            "date": "DateTime";
			        };
			        "types": {};
			    };
			    "policy": "CacheOrNetwork";
			    "partial": false;
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
			    readonly "input": MyQuery$input;
			    readonly "result": MyQuery$result | undefined;
			};

			export type MyQuery$result = {
			    readonly listOfLists: (({
			        readonly firstName: string;
			        readonly nickname: string | null;
			    } | null)[] | null)[];
			};

			export type MyQuery$input = null;

			export type MyQuery$artifact = {
			    "name": "MyQuery";
			    "kind": "HoudiniQuery";
			    "hash": "4cb15eb98773616237ea21f31c9e29a714169520863e6e6b1357577418105323";
			    "raw": \`query MyQuery {
			  listOfLists {
			    firstName
			    nickname
			    id
			  }
			}
			\`;
			    "rootType": "Query";
			    "selection": {
			        "fields": {
			            "listOfLists": {
			                "type": "User";
			                "keyRaw": "listOfLists";
			                "selection": {
			                    "fields": {
			                        "firstName": {
			                            "type": "String";
			                            "keyRaw": "firstName";
			                            "visible": true;
			                        };
			                        "nickname": {
			                            "type": "String";
			                            "keyRaw": "nickname";
			                            "nullable": true;
			                            "visible": true;
			                        };
			                        "id": {
			                            "type": "ID";
			                            "keyRaw": "id";
			                            "visible": true;
			                        };
			                    };
			                };
			                "visible": true;
			            };
			        };
			    };
			    "pluginData": {};
			    "policy": "CacheOrNetwork";
			    "partial": false;
			};
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
			    readonly "input": MyQuery$input;
			    readonly "result": MyQuery$result | undefined;
			};

			export type MyQuery$result = {
			    readonly user: {
			        readonly parent: {
			            readonly firstName: string;
			            readonly nickname: string | null;
			        } | null;
			    } | null;
			};

			export type MyQuery$input = null;

			export type MyQuery$artifact = {
			    "name": "MyQuery";
			    "kind": "HoudiniQuery";
			    "hash": "5e605fac9ecffb118de5ff29e5c16c7c5ea2864ad69847c83131701bc311fb3c";
			    "raw": \`query MyQuery {
			  user {
			    parent {
			      firstName
			      firstName
			      id
			    }
			    parent {
			      nickname
			      id
			    }
			    id
			  }
			}
			\`;
			    "rootType": "Query";
			    "selection": {
			        "fields": {
			            "user": {
			                "type": "User";
			                "keyRaw": "user";
			                "nullable": true;
			                "selection": {
			                    "fields": {
			                        "parent": {
			                            "type": "User";
			                            "keyRaw": "parent";
			                            "nullable": true;
			                            "selection": {
			                                "fields": {
			                                    "firstName": {
			                                        "type": "String";
			                                        "keyRaw": "firstName";
			                                        "visible": true;
			                                    };
			                                    "id": {
			                                        "type": "ID";
			                                        "keyRaw": "id";
			                                        "visible": true;
			                                    };
			                                    "nickname": {
			                                        "type": "String";
			                                        "keyRaw": "nickname";
			                                        "nullable": true;
			                                        "visible": true;
			                                    };
			                                };
			                            };
			                            "visible": true;
			                        };
			                        "id": {
			                            "type": "ID";
			                            "keyRaw": "id";
			                            "visible": true;
			                        };
			                    };
			                };
			                "visible": true;
			            };
			        };
			    };
			    "pluginData": {};
			    "policy": "CacheOrNetwork";
			    "partial": false;
			};
		`)
	})

	test('can reference list fragments', async function () {
		const unmaskedConfig = testConfig({
			defaultFragmentMasking: 'disable',
			schema: config.schema,
		})

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
			import type { ValueOf } from "$houdini/runtime/lib/types";
			import type { MyEnum } from "$houdini/graphql/enums";

			export type MyMutation = {
			    readonly "input": MyMutation$input;
			    readonly "result": MyMutation$result;
			};

			export type MyMutation$result = {
			    readonly doThing: {
			        readonly id: string;
			        readonly " $fragments": {
			            My_Users_remove: {};
			            My_Users_insert: {};
			        };
			    } | null;
			};

			type NestedUserFilter = {
			    id: string;
			    firstName: string;
			    admin?: boolean | null | undefined;
			    age?: number | null | undefined;
			    weight?: number | null | undefined;
			};

			type UserFilter = {
			    middle?: NestedUserFilter | null | undefined;
			    listRequired: (string)[];
			    nullList?: (string | null | undefined)[] | null | undefined;
			    recursive?: UserFilter | null | undefined;
			    enum?: ValueOf<typeof MyEnum> | null | undefined;
			};

			export type MyMutation$input = {
			    filter?: UserFilter | null | undefined;
			    filterList: (UserFilter)[];
			    id: string;
			    firstName: string;
			    admin?: boolean | null | undefined;
			    age?: number | null | undefined;
			    weight?: number | null | undefined;
			};

			export type MyMutation$optimistic = {
			    readonly doThing?: {
			        readonly id?: string;
			    } | null;
			};

			export type MyMutation$artifact = {
			    "name": "MyMutation";
			    "kind": "HoudiniMutation";
			    "hash": "2e9d4fb27d8810e3df6f6841fb5c62795a29ab597bd9b72a48bf23bdc24254ba";
			    "raw": \`mutation MyMutation($filter: UserFilter, $filterList: [UserFilter!]!, $id: ID!, $firstName: String!, $admin: Boolean, $age: Int, $weight: Float) {
			  doThing(
			    filter: $filter
			    list: $filterList
			    id: $id
			    firstName: $firstName
			    admin: $admin
			    age: $age
			    weight: $weight
			  ) {
			    ...My_Users_remove
			    ...My_Users_insert
			    id
			  }
			}

			fragment My_Users_remove on User {
			  id
			}

			fragment My_Users_insert on User {
			  id
			}
			\`;
			    "rootType": "Mutation";
			    "selection": {
			        "fields": {
			            "doThing": {
			                "type": "User";
			                "keyRaw": "doThing(admin: $admin, age: $age, filter: $filter, firstName: $firstName, id: $id, list: $filterList, weight: $weight)";
			                "nullable": true;
			                "operations": [{
			                    "action": "remove";
			                    "list": "My_Users";
			                }, {
			                    "action": "insert";
			                    "list": "My_Users";
			                    "position": "last";
			                }];
			                "selection": {
			                    "fields": {
			                        "id": {
			                            "type": "ID";
			                            "keyRaw": "id";
			                            "visible": true;
			                        };
			                    };
			                    "fragments": {
			                        "My_Users_remove": {
			                            "arguments": {};
			                        };
			                        "My_Users_insert": {
			                            "arguments": {};
			                        };
			                    };
			                };
			                "visible": true;
			            };
			        };
			    };
			    "pluginData": {};
			    "input": {
			        "fields": {
			            "filter": "UserFilter";
			            "filterList": "UserFilter";
			            "id": "ID";
			            "firstName": "String";
			            "admin": "Boolean";
			            "age": "Int";
			            "weight": "Float";
			        };
			        "types": {
			            "NestedUserFilter": {
			                "id": "ID";
			                "firstName": "String";
			                "admin": "Boolean";
			                "age": "Int";
			                "weight": "Float";
			            };
			            "UserFilter": {
			                "middle": "NestedUserFilter";
			                "listRequired": "String";
			                "nullList": "String";
			                "recursive": "UserFilter";
			                "enum": "MyEnum";
			            };
			        };
			    };
			};
		`)
	})

	test('masking disabled', async function () {
		const unmaskedConfig = testConfig({})

		// the documents to test
		// the document to test
		const docs = [
			mockCollectedDoc(`query FragmentUpdateTestQuery($id: ID!) {
				node(id: $id) {
					...UserFragmentTestFragment @mask_disable
				}
			}`),
			mockCollectedDoc(`fragment UserFragmentTestFragment on User {
				name
			}`),
		]

		// execute the generator
		await runPipeline(unmaskedConfig, docs)

		expect(docs[0]).toMatchInlineSnapshot(`
			export default {
			    "name": "FragmentUpdateTestQuery",
			    "kind": "HoudiniQuery",
			    "hash": "4434920e89b1bfe99299f1c866e3cdc8ef90d336e7e0f2127ab281d0795ebc1f",

			    "raw": \`query FragmentUpdateTestQuery($id: ID!) {
			  node(id: $id) {
			    ...UserFragmentTestFragment
			    id
			    __typename
			  }
			}

			fragment UserFragmentTestFragment on User {
			  name
			  id
			  __typename
			}
			\`,

			    "rootType": "Query",

			    "selection": {
			        "fields": {
			            "node": {
			                "type": "Node",
			                "keyRaw": "node(id: $id)",
			                "nullable": true,

			                "selection": {
			                    "abstractFields": {
			                        "fields": {
			                            "User": {
			                                "name": {
			                                    "type": "String",
			                                    "keyRaw": "name",
			                                    "visible": true
			                                },

			                                "id": {
			                                    "type": "ID",
			                                    "keyRaw": "id",
			                                    "visible": true
			                                },

			                                "__typename": {
			                                    "type": "String",
			                                    "keyRaw": "__typename",
			                                    "visible": true
			                                }
			                            }
			                        },

			                        "typeMap": {}
			                    },

			                    "fields": {
			                        "id": {
			                            "type": "ID",
			                            "keyRaw": "id",
			                            "visible": true
			                        },

			                        "__typename": {
			                            "type": "String",
			                            "keyRaw": "__typename",
			                            "visible": true
			                        }
			                    },

			                    "fragments": {
			                        "UserFragmentTestFragment": {
			                            "arguments": {}
			                        }
			                    }
			                },

			                "abstract": true,
			                "visible": true
			            }
			        }
			    },

			    "pluginData": {},

			    "input": {
			        "fields": {
			            "id": "ID"
			        },

			        "types": {}
			    },

			    "policy": "CacheOrNetwork",
			    "partial": false
			};

			"HoudiniHash=af4a3a796a91fef5a4625b3b886bedeeef1e1698a1aa9a22bdbf2d65c9c0d4f5";
		`)
	})

	test('disable default fragment masking', async function () {
		const configWithoutMasking = testConfig({
			defaultFragmentMasking: 'disable',
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
			    readonly "input": MyQuery$input;
			    readonly "result": MyQuery$result | undefined;
			};

			export type MyQuery$result = {
			    readonly user: {
			        readonly id: string;
			        readonly firstName: string;
			        readonly friends: ({
			            readonly id: string;
			            readonly firstName: string;
			            readonly " $fragments": {
			                UserBase: {};
			            };
			        } | null)[] | null;
			        readonly " $fragments": {
			            UserBase: {};
			            UserMore: {};
			        };
			    } | null;
			};

			export type MyQuery$input = null;

			export type MyQuery$artifact = {
			    "name": "MyQuery";
			    "kind": "HoudiniQuery";
			    "hash": "a94ed9848e2dd8e4333e0c8a18758754b34f70f5a81a041637ab0f290e4842f3";
			    "raw": \`query MyQuery {
			  user {
			    ...UserBase
			    ...UserMore
			    id
			  }
			}

			fragment UserBase on User {
			  id
			  firstName
			  __typename
			}

			fragment UserMore on User {
			  friends {
			    ...UserBase
			    id
			  }
			  id
			  __typename
			}
			\`;
			    "rootType": "Query";
			    "selection": {
			        "fields": {
			            "user": {
			                "type": "User";
			                "keyRaw": "user";
			                "nullable": true;
			                "selection": {
			                    "fields": {
			                        "id": {
			                            "type": "ID";
			                            "keyRaw": "id";
			                            "visible": true;
			                        };
			                        "firstName": {
			                            "type": "String";
			                            "keyRaw": "firstName";
			                            "visible": true;
			                        };
			                        "__typename": {
			                            "type": "String";
			                            "keyRaw": "__typename";
			                            "visible": true;
			                        };
			                        "friends": {
			                            "type": "User";
			                            "keyRaw": "friends";
			                            "nullable": true;
			                            "selection": {
			                                "fields": {
			                                    "id": {
			                                        "type": "ID";
			                                        "keyRaw": "id";
			                                        "visible": true;
			                                    };
			                                    "firstName": {
			                                        "type": "String";
			                                        "keyRaw": "firstName";
			                                        "visible": true;
			                                    };
			                                    "__typename": {
			                                        "type": "String";
			                                        "keyRaw": "__typename";
			                                        "visible": true;
			                                    };
			                                };
			                                "fragments": {
			                                    "UserBase": {
			                                        "arguments": {};
			                                    };
			                                };
			                            };
			                            "visible": true;
			                        };
			                    };
			                    "fragments": {
			                        "UserBase": {
			                            "arguments": {};
			                        };
			                        "UserMore": {
			                            "arguments": {};
			                        };
			                    };
			                };
			                "visible": true;
			            };
			        };
			    };
			    "pluginData": {};
			    "policy": "CacheOrNetwork";
			    "partial": false;
			};
		`)
	})

	test('disable individual fragment masking', async function () {
		const configWithMasking = testConfig({
			defaultFragmentMasking: 'enable',
			schema: config.schema,
		})

		const docs = [
			mockCollectedDoc(`
				query MyQuery {
					user {
						...UserBase @mask_disable
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
			    readonly "input": MyQuery$input;
			    readonly "result": MyQuery$result | undefined;
			};

			export type MyQuery$result = {
			    readonly user: {
			        readonly id: string;
			        readonly firstName: string;
			        readonly " $fragments": {
			            UserBase: {};
			            UserMore: {};
			        };
			    } | null;
			};

			export type MyQuery$input = null;

			export type MyQuery$artifact = {
			    "name": "MyQuery";
			    "kind": "HoudiniQuery";
			    "hash": "a94ed9848e2dd8e4333e0c8a18758754b34f70f5a81a041637ab0f290e4842f3";
			    "raw": \`query MyQuery {
			  user {
			    ...UserBase
			    ...UserMore
			    id
			  }
			}

			fragment UserBase on User {
			  id
			  firstName
			  __typename
			}

			fragment UserMore on User {
			  friends {
			    ...UserBase
			    id
			  }
			  id
			  __typename
			}
			\`;
			    "rootType": "Query";
			    "selection": {
			        "fields": {
			            "user": {
			                "type": "User";
			                "keyRaw": "user";
			                "nullable": true;
			                "selection": {
			                    "fields": {
			                        "id": {
			                            "type": "ID";
			                            "keyRaw": "id";
			                            "visible": true;
			                        };
			                        "firstName": {
			                            "type": "String";
			                            "keyRaw": "firstName";
			                            "visible": true;
			                        };
			                        "__typename": {
			                            "type": "String";
			                            "keyRaw": "__typename";
			                            "visible": true;
			                        };
			                        "friends": {
			                            "type": "User";
			                            "keyRaw": "friends";
			                            "nullable": true;
			                            "selection": {
			                                "fields": {
			                                    "id": {
			                                        "type": "ID";
			                                        "keyRaw": "id";
			                                        "visible": true;
			                                    };
			                                    "firstName": {
			                                        "type": "String";
			                                        "keyRaw": "firstName";
			                                    };
			                                    "__typename": {
			                                        "type": "String";
			                                        "keyRaw": "__typename";
			                                    };
			                                };
			                            };
			                        };
			                    };
			                    "fragments": {
			                        "UserBase": {
			                            "arguments": {};
			                        };
			                        "UserMore": {
			                            "arguments": {};
			                        };
			                    };
			                };
			                "visible": true;
			            };
			        };
			    };
			    "pluginData": {};
			    "policy": "CacheOrNetwork";
			    "partial": false;
			};
		`)

		expect(
			recast.parse(fragmentFileContents!, {
				parser: typeScriptParser,
			})
		).toMatchInlineSnapshot(`
			export type UserMore$input = {};

			export type UserMore = {
			    readonly "shape"?: UserMore$data;
			    readonly " $fragments": {
			        "UserMore": any;
			    };
			};

			export type UserMore$data = {
			    readonly friends: ({
			        readonly " $fragments": {
			            UserBase: {};
			        };
			    } | null)[] | null;
			};

			export type UserMore$artifact = {
			    "name": "UserMore";
			    "kind": "HoudiniFragment";
			    "hash": "05f8f02e7cfe5214be392f0710ecb2e4c214dbae2c496078888bb8ed7770bdb3";
			    "raw": \`fragment UserMore on User {
			  friends {
			    ...UserBase
			    id
			  }
			  id
			  __typename
			}

			fragment UserBase on User {
			  id
			  firstName
			  __typename
			}
			\`;
			    "rootType": "User";
			    "selection": {
			        "fields": {
			            "friends": {
			                "type": "User";
			                "keyRaw": "friends";
			                "nullable": true;
			                "selection": {
			                    "fields": {
			                        "id": {
			                            "type": "ID";
			                            "keyRaw": "id";
			                            "visible": true;
			                        };
			                    };
			                    "fragments": {
			                        "UserBase": {
			                            "arguments": {};
			                        };
			                    };
			                };
			                "visible": true;
			            };
			            "id": {
			                "type": "ID";
			                "keyRaw": "id";
			                "visible": true;
			            };
			            "__typename": {
			                "type": "String";
			                "keyRaw": "__typename";
			                "visible": true;
			            };
			        };
			    };
			    "pluginData": {};
			};
		`)
	})

	test('enable individual fragment masking', async function () {
		const configWithoutMasking = testConfig({
			defaultFragmentMasking: 'disable',
			schema: config.schema,
		})

		const docs = [
			mockCollectedDoc(`
				query MyQuery {
					user {
						...UserBase @mask_enable
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
			    readonly "input": MyQuery$input;
			    readonly "result": MyQuery$result | undefined;
			};

			export type MyQuery$result = {
			    readonly user: {
			        readonly friends: ({
			            readonly id: string;
			            readonly firstName: string;
			            readonly " $fragments": {
			                UserBase: {};
			            };
			        } | null)[] | null;
			        readonly " $fragments": {
			            UserBase: {};
			            UserMore: {};
			        };
			    } | null;
			};

			export type MyQuery$input = null;

			export type MyQuery$artifact = {
			    "name": "MyQuery";
			    "kind": "HoudiniQuery";
			    "hash": "a94ed9848e2dd8e4333e0c8a18758754b34f70f5a81a041637ab0f290e4842f3";
			    "raw": \`query MyQuery {
			  user {
			    ...UserBase
			    ...UserMore
			    id
			  }
			}

			fragment UserBase on User {
			  id
			  firstName
			  __typename
			}

			fragment UserMore on User {
			  friends {
			    ...UserBase
			    id
			  }
			  id
			  __typename
			}
			\`;
			    "rootType": "Query";
			    "selection": {
			        "fields": {
			            "user": {
			                "type": "User";
			                "keyRaw": "user";
			                "nullable": true;
			                "selection": {
			                    "fields": {
			                        "id": {
			                            "type": "ID";
			                            "keyRaw": "id";
			                            "visible": true;
			                        };
			                        "firstName": {
			                            "type": "String";
			                            "keyRaw": "firstName";
			                        };
			                        "__typename": {
			                            "type": "String";
			                            "keyRaw": "__typename";
			                            "visible": true;
			                        };
			                        "friends": {
			                            "type": "User";
			                            "keyRaw": "friends";
			                            "nullable": true;
			                            "selection": {
			                                "fields": {
			                                    "id": {
			                                        "type": "ID";
			                                        "keyRaw": "id";
			                                        "visible": true;
			                                    };
			                                    "firstName": {
			                                        "type": "String";
			                                        "keyRaw": "firstName";
			                                        "visible": true;
			                                    };
			                                    "__typename": {
			                                        "type": "String";
			                                        "keyRaw": "__typename";
			                                        "visible": true;
			                                    };
			                                };
			                                "fragments": {
			                                    "UserBase": {
			                                        "arguments": {};
			                                    };
			                                };
			                            };
			                            "visible": true;
			                        };
			                    };
			                    "fragments": {
			                        "UserBase": {
			                            "arguments": {};
			                        };
			                        "UserMore": {
			                            "arguments": {};
			                        };
			                    };
			                };
			                "visible": true;
			            };
			        };
			    };
			    "pluginData": {};
			    "policy": "CacheOrNetwork";
			    "partial": false;
			};
		`)

		expect(
			recast.parse(fragmentFileContents!, {
				parser: typeScriptParser,
			})
		).toMatchInlineSnapshot(`
			export type UserMore$input = {};

			export type UserMore = {
			    readonly "shape"?: UserMore$data;
			    readonly " $fragments": {
			        "UserMore": any;
			    };
			};

			export type UserMore$data = {
			    readonly friends: ({
			        readonly id: string;
			        readonly firstName: string;
			        readonly " $fragments": {
			            UserBase: {};
			        };
			    } | null)[] | null;
			};

			export type UserMore$artifact = {
			    "name": "UserMore";
			    "kind": "HoudiniFragment";
			    "hash": "05f8f02e7cfe5214be392f0710ecb2e4c214dbae2c496078888bb8ed7770bdb3";
			    "raw": \`fragment UserMore on User {
			  friends {
			    ...UserBase
			    id
			  }
			  id
			  __typename
			}

			fragment UserBase on User {
			  id
			  firstName
			  __typename
			}
			\`;
			    "rootType": "User";
			    "selection": {
			        "fields": {
			            "friends": {
			                "type": "User";
			                "keyRaw": "friends";
			                "nullable": true;
			                "selection": {
			                    "fields": {
			                        "id": {
			                            "type": "ID";
			                            "keyRaw": "id";
			                            "visible": true;
			                        };
			                        "firstName": {
			                            "type": "String";
			                            "keyRaw": "firstName";
			                            "visible": true;
			                        };
			                        "__typename": {
			                            "type": "String";
			                            "keyRaw": "__typename";
			                            "visible": true;
			                        };
			                    };
			                    "fragments": {
			                        "UserBase": {
			                            "arguments": {};
			                        };
			                    };
			                };
			                "visible": true;
			            };
			            "id": {
			                "type": "ID";
			                "keyRaw": "id";
			                "visible": true;
			            };
			            "__typename": {
			                "type": "String";
			                "keyRaw": "__typename";
			                "visible": true;
			            };
			        };
			    };
			    "pluginData": {};
			};
		`)
	})

	test('@include and @skip directives add undefined to the type union', async function () {
		const doc = mockCollectedDoc(`
		    query MyQuery {
		        user {
		            id
		            firstName @include(if: true)
		            admin @skip(if: true)
		        }
		    }
		`)

		await runPipeline(config, [doc])

		const fileContents = await fs.readFile(config.artifactTypePath(doc.document))

		expect(
			recast.parse(fileContents!, {
				parser: typeScriptParser,
			})
		).toMatchInlineSnapshot(`
			export type MyQuery = {
			    readonly "input": MyQuery$input;
			    readonly "result": MyQuery$result | undefined;
			};

			export type MyQuery$result = {
			    readonly user: {
			        readonly id: string;
			        readonly firstName: string | undefined;
			        readonly admin: boolean | null | undefined;
			    } | null;
			};

			export type MyQuery$input = null;

			export type MyQuery$artifact = {
			    "name": "MyQuery";
			    "kind": "HoudiniQuery";
			    "hash": "43bc5d57ac3149cf1e85cd1ad9892f10c9439e8678898408a348cec3214facc3";
			    "raw": \`query MyQuery {
			  user {
			    id
			    firstName @include(if: true)
			    admin @skip(if: true)
			  }
			}
			\`;
			    "rootType": "Query";
			    "selection": {
			        "fields": {
			            "user": {
			                "type": "User";
			                "keyRaw": "user";
			                "nullable": true;
			                "selection": {
			                    "fields": {
			                        "id": {
			                            "type": "ID";
			                            "keyRaw": "id";
			                            "visible": true;
			                        };
			                        "firstName": {
			                            "type": "String";
			                            "keyRaw": "firstName";
			                            "directives": [{
			                                "name": "include";
			                                "arguments": {
			                                    "if": {
			                                        "kind": "BooleanValue";
			                                        "value": true;
			                                    };
			                                };
			                            }];
			                            "visible": true;
			                        };
			                        "admin": {
			                            "type": "Boolean";
			                            "keyRaw": "admin";
			                            "directives": [{
			                                "name": "skip";
			                                "arguments": {
			                                    "if": {
			                                        "kind": "BooleanValue";
			                                        "value": true;
			                                    };
			                                };
			                            }];
			                            "nullable": true;
			                            "visible": true;
			                        };
			                    };
			                };
			                "visible": true;
			            };
			        };
			    };
			    "pluginData": {};
			    "policy": "CacheOrNetwork";
			    "partial": false;
			};
		`)
	})

	test('@required directive removes nullability from field', async function () {
		const doc = mockCollectedDoc(`
			query MyQuery {
				user {
					id
					firstName
					nickname @required
				}
			}
		`)

		await runPipeline(config, [doc])

		const fileContents = await fs.readFile(config.artifactTypePath(doc.document))

		expect(
			recast.parse(fileContents!, {
				parser: typeScriptParser,
			})
		).toMatchInlineSnapshot(`
			export type MyQuery = {
			    readonly "input": MyQuery$input;
			    readonly "result": MyQuery$result | undefined;
			};

			export type MyQuery$result = {
			    readonly user: {
			        readonly id: string;
			        readonly firstName: string;
			        readonly nickname: string;
			    } | null;
			};

			export type MyQuery$input = null;

			export type MyQuery$artifact = {
			    "name": "MyQuery";
			    "kind": "HoudiniQuery";
			    "hash": "64aadd5da34f840d6aebd47dd935f24cf375b3cc0ae56cda9ed3f32a0c771513";
			    "raw": \`query MyQuery {
			  user {
			    id
			    firstName
			    nickname
			  }
			}
			\`;
			    "rootType": "Query";
			    "selection": {
			        "fields": {
			            "user": {
			                "type": "User";
			                "keyRaw": "user";
			                "nullable": true;
			                "selection": {
			                    "fields": {
			                        "id": {
			                            "type": "ID";
			                            "keyRaw": "id";
			                            "visible": true;
			                        };
			                        "firstName": {
			                            "type": "String";
			                            "keyRaw": "firstName";
			                            "visible": true;
			                        };
			                        "nickname": {
			                            "type": "String";
			                            "keyRaw": "nickname";
			                            "directives": [{
			                                "name": "required";
			                                "arguments": {};
			                            }];
			                            "nullable": false;
			                            "required": true;
			                            "visible": true;
			                        };
			                    };
			                };
			                "visible": true;
			            };
			        };
			    };
			    "pluginData": {};
			    "policy": "CacheOrNetwork";
			    "partial": false;
			};
		`)
	})

	test('@required directive adds nullability to parent', async function () {
		const doc = mockCollectedDoc(`
			query MyQuery {
				user {
					parent @required {
						id
						firstName
						nickname
					}
				}
			}
		`)

		await runPipeline(config, [doc])

		const fileContents = await fs.readFile(config.artifactTypePath(doc.document))

		expect(
			recast.parse(fileContents!, {
				parser: typeScriptParser,
			})
		).toMatchInlineSnapshot(`
			export type MyQuery = {
			    readonly "input": MyQuery$input;
			    readonly "result": MyQuery$result | undefined;
			};

			export type MyQuery$result = {
			    readonly user: {
			        readonly parent: {
			            readonly id: string;
			            readonly firstName: string;
			            readonly nickname: string | null;
			        };
			    } | null;
			};

			export type MyQuery$input = null;

			export type MyQuery$artifact = {
			    "name": "MyQuery";
			    "kind": "HoudiniQuery";
			    "hash": "751e176aa2e6cd8e49b1fa3ad513a73fddef99bfff04217f42cd30b72430ee8f";
			    "raw": \`query MyQuery {
			  user {
			    parent {
			      id
			      firstName
			      nickname
			    }
			    id
			  }
			}
			\`;
			    "rootType": "Query";
			    "selection": {
			        "fields": {
			            "user": {
			                "type": "User";
			                "keyRaw": "user";
			                "nullable": true;
			                "selection": {
			                    "fields": {
			                        "parent": {
			                            "type": "User";
			                            "keyRaw": "parent";
			                            "directives": [{
			                                "name": "required";
			                                "arguments": {};
			                            }];
			                            "nullable": false;
			                            "required": true;
			                            "selection": {
			                                "fields": {
			                                    "id": {
			                                        "type": "ID";
			                                        "keyRaw": "id";
			                                        "visible": true;
			                                    };
			                                    "firstName": {
			                                        "type": "String";
			                                        "keyRaw": "firstName";
			                                        "visible": true;
			                                    };
			                                    "nickname": {
			                                        "type": "String";
			                                        "keyRaw": "nickname";
			                                        "nullable": true;
			                                        "visible": true;
			                                    };
			                                };
			                            };
			                            "visible": true;
			                        };
			                        "id": {
			                            "type": "ID";
			                            "keyRaw": "id";
			                            "visible": true;
			                        };
			                    };
			                };
			                "visible": true;
			            };
			        };
			    };
			    "pluginData": {};
			    "policy": "CacheOrNetwork";
			    "partial": false;
			};
		`)
	})

	test('@required directive works recursively', async function () {
		const doc = mockCollectedDoc(`
			query MyQuery {
				user {
					parent @required {
						id
						firstName
						nickname @required
					}
				}
			}
		`)

		await runPipeline(config, [doc])

		const fileContents = await fs.readFile(config.artifactTypePath(doc.document))

		expect(
			recast.parse(fileContents!, {
				parser: typeScriptParser,
			})
		).toMatchInlineSnapshot(`
			export type MyQuery = {
			    readonly "input": MyQuery$input;
			    readonly "result": MyQuery$result | undefined;
			};

			export type MyQuery$result = {
			    readonly user: {
			        readonly parent: {
			            readonly id: string;
			            readonly firstName: string;
			            readonly nickname: string;
			        };
			    } | null;
			};

			export type MyQuery$input = null;

			export type MyQuery$artifact = {
			    "name": "MyQuery";
			    "kind": "HoudiniQuery";
			    "hash": "751e176aa2e6cd8e49b1fa3ad513a73fddef99bfff04217f42cd30b72430ee8f";
			    "raw": \`query MyQuery {
			  user {
			    parent {
			      id
			      firstName
			      nickname
			    }
			    id
			  }
			}
			\`;
			    "rootType": "Query";
			    "selection": {
			        "fields": {
			            "user": {
			                "type": "User";
			                "keyRaw": "user";
			                "nullable": true;
			                "selection": {
			                    "fields": {
			                        "parent": {
			                            "type": "User";
			                            "keyRaw": "parent";
			                            "directives": [{
			                                "name": "required";
			                                "arguments": {};
			                            }];
			                            "nullable": true;
			                            "required": true;
			                            "selection": {
			                                "fields": {
			                                    "id": {
			                                        "type": "ID";
			                                        "keyRaw": "id";
			                                        "visible": true;
			                                    };
			                                    "firstName": {
			                                        "type": "String";
			                                        "keyRaw": "firstName";
			                                        "visible": true;
			                                    };
			                                    "nickname": {
			                                        "type": "String";
			                                        "keyRaw": "nickname";
			                                        "directives": [{
			                                            "name": "required";
			                                            "arguments": {};
			                                        }];
			                                        "nullable": false;
			                                        "required": true;
			                                        "visible": true;
			                                    };
			                                };
			                            };
			                            "visible": true;
			                        };
			                        "id": {
			                            "type": "ID";
			                            "keyRaw": "id";
			                            "visible": true;
			                        };
			                    };
			                };
			                "visible": true;
			            };
			        };
			    };
			    "pluginData": {};
			    "policy": "CacheOrNetwork";
			    "partial": false;
			};
		`)
	})

	test('@required directive makes non-nullable parent nullable', async function () {
		const doc = mockCollectedDoc(`
			query MyQuery {
				user {
					parentRequired {
						id
						firstName
						nickname @required
					}
				}
			}
		`)

		await runPipeline(config, [doc])

		const fileContents = await fs.readFile(config.artifactTypePath(doc.document))

		expect(
			recast.parse(fileContents!, {
				parser: typeScriptParser,
			})
		).toMatchInlineSnapshot(`
			export type MyQuery = {
			    readonly "input": MyQuery$input;
			    readonly "result": MyQuery$result | undefined;
			};

			export type MyQuery$result = {
			    readonly user: {
			        readonly parentRequired: {
			            readonly id: string;
			            readonly firstName: string;
			            readonly nickname: string;
			        } | null;
			    } | null;
			};

			export type MyQuery$input = null;

			export type MyQuery$artifact = {
			    "name": "MyQuery";
			    "kind": "HoudiniQuery";
			    "hash": "26993fab9f8e30de38fd328bd3914ce7688f0e795ce1c9d692146660cf5ae2cb";
			    "raw": \`query MyQuery {
			  user {
			    parentRequired {
			      id
			      firstName
			      nickname
			    }
			    id
			  }
			}
			\`;
			    "rootType": "Query";
			    "selection": {
			        "fields": {
			            "user": {
			                "type": "User";
			                "keyRaw": "user";
			                "nullable": true;
			                "selection": {
			                    "fields": {
			                        "parentRequired": {
			                            "type": "User";
			                            "keyRaw": "parentRequired";
			                            "selection": {
			                                "fields": {
			                                    "id": {
			                                        "type": "ID";
			                                        "keyRaw": "id";
			                                        "visible": true;
			                                    };
			                                    "firstName": {
			                                        "type": "String";
			                                        "keyRaw": "firstName";
			                                        "visible": true;
			                                    };
			                                    "nickname": {
			                                        "type": "String";
			                                        "keyRaw": "nickname";
			                                        "directives": [{
			                                            "name": "required";
			                                            "arguments": {};
			                                        }];
			                                        "nullable": false;
			                                        "required": true;
			                                        "visible": true;
			                                    };
			                                };
			                            };
			                            "nullable": true;
			                            "visible": true;
			                        };
			                        "id": {
			                            "type": "ID";
			                            "keyRaw": "id";
			                            "visible": true;
			                        };
			                    };
			                };
			                "visible": true;
			            };
			        };
			    };
			    "pluginData": {};
			    "policy": "CacheOrNetwork";
			    "partial": false;
			};
		`)
	})

	test('@required in fragments', async function () {
		// the document to test
		const doc = mockCollectedDoc(`
			fragment MyFragment on User {
				id
				firstName
				nickname @required
				parent @required {
					id
					firstName
					nickname @required
				}
				parentRequired {
					id
					firstName
					nickname @required
				}
			}
		`)

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
			export type MyFragment$input = {};

			export type MyFragment = {
			    readonly "shape"?: MyFragment$data;
			    readonly " $fragments": {
			        "MyFragment": any;
			    };
			};

			export type MyFragment$data = {
			    readonly id: string;
			    readonly firstName: string;
			    readonly nickname: string;
			    readonly parent: {
			        readonly id: string;
			        readonly firstName: string;
			        readonly nickname: string;
			    };
			    readonly parentRequired: {
			        readonly id: string;
			        readonly firstName: string;
			        readonly nickname: string;
			    } | null;
			} | null;

			export type MyFragment$artifact = {
			    "name": "MyFragment";
			    "kind": "HoudiniFragment";
			    "hash": "6d0215530b0d99ef798e31dc8bc1e2a250de5c197868027f1452b5cf22410b0a";
			    "raw": \`fragment MyFragment on User {
			  id
			  firstName
			  nickname
			  parent {
			    id
			    firstName
			    nickname
			  }
			  parentRequired {
			    id
			    firstName
			    nickname
			  }
			  __typename
			}
			\`;
			    "rootType": "User";
			    "selection": {
			        "fields": {
			            "id": {
			                "type": "ID";
			                "keyRaw": "id";
			                "visible": true;
			            };
			            "firstName": {
			                "type": "String";
			                "keyRaw": "firstName";
			                "visible": true;
			            };
			            "nickname": {
			                "type": "String";
			                "keyRaw": "nickname";
			                "directives": [{
			                    "name": "required";
			                    "arguments": {};
			                }];
			                "nullable": false;
			                "required": true;
			                "visible": true;
			            };
			            "parent": {
			                "type": "User";
			                "keyRaw": "parent";
			                "directives": [{
			                    "name": "required";
			                    "arguments": {};
			                }];
			                "nullable": true;
			                "required": true;
			                "selection": {
			                    "fields": {
			                        "id": {
			                            "type": "ID";
			                            "keyRaw": "id";
			                            "visible": true;
			                        };
			                        "firstName": {
			                            "type": "String";
			                            "keyRaw": "firstName";
			                            "visible": true;
			                        };
			                        "nickname": {
			                            "type": "String";
			                            "keyRaw": "nickname";
			                            "directives": [{
			                                "name": "required";
			                                "arguments": {};
			                            }];
			                            "nullable": false;
			                            "required": true;
			                            "visible": true;
			                        };
			                    };
			                };
			                "visible": true;
			            };
			            "parentRequired": {
			                "type": "User";
			                "keyRaw": "parentRequired";
			                "selection": {
			                    "fields": {
			                        "id": {
			                            "type": "ID";
			                            "keyRaw": "id";
			                            "visible": true;
			                        };
			                        "firstName": {
			                            "type": "String";
			                            "keyRaw": "firstName";
			                            "visible": true;
			                        };
			                        "nickname": {
			                            "type": "String";
			                            "keyRaw": "nickname";
			                            "directives": [{
			                                "name": "required";
			                                "arguments": {};
			                            }];
			                            "nullable": false;
			                            "required": true;
			                            "visible": true;
			                        };
			                    };
			                };
			                "nullable": true;
			                "visible": true;
			            };
			            "__typename": {
			                "type": "String";
			                "keyRaw": "__typename";
			                "visible": true;
			            };
			        };
			    };
			    "pluginData": {};
			};
		`)
	})

	test('@required in fragments', async function () {
		// the document to test
		const doc = mockCollectedDoc(`
			fragment MyFragmentInterfaceA on Node {
				... on User {
					nickname @required
				}
			}
			fragment MyFragmentInterfaceB on Node {
				__typename
				... on User {
					nickname @required
				}
			}
			fragment MyFragmentUnionA on Entity {
				... on User {
					nickname @required
				}
			}
			fragment MyFragmentUnionB on Node {
				__typename
				... on User {
					nickname @required
				}
			}
		`)

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
			export type MyFragmentInterfaceA$input = {};

			export type MyFragmentInterfaceA = {
			    readonly "shape"?: MyFragmentInterfaceA$data;
			    readonly " $fragments": {
			        "MyFragmentInterfaceA": any;
			    };
			};

			export type MyFragmentInterfaceA$data = {} & (({
			    readonly nickname: string;
			    readonly __typename: "User";
			}) | ({
			    readonly __typename: "non-exhaustive; don't match this";
			}));

			export type MyFragmentInterfaceB$input = {};

			export type MyFragmentInterfaceB = {
			    readonly "shape"?: MyFragmentInterfaceB$data;
			    readonly " $fragments": {
			        "MyFragmentInterfaceB": any;
			    };
			};

			export type MyFragmentInterfaceB$data = {} & (({
			    readonly nickname: string;
			    readonly __typename: "User";
			}) | ({
			    readonly __typename: "non-exhaustive; don't match this";
			}));

			export type MyFragmentUnionA$input = {};

			export type MyFragmentUnionA = {
			    readonly "shape"?: MyFragmentUnionA$data;
			    readonly " $fragments": {
			        "MyFragmentUnionA": any;
			    };
			};

			export type MyFragmentUnionA$data = {} & (({
			    readonly nickname: string;
			    readonly __typename: "User";
			}) | ({
			    readonly __typename: "non-exhaustive; don't match this";
			}));

			export type MyFragmentUnionB$input = {};

			export type MyFragmentUnionB = {
			    readonly "shape"?: MyFragmentUnionB$data;
			    readonly " $fragments": {
			        "MyFragmentUnionB": any;
			    };
			};

			export type MyFragmentUnionB$data = {} & (({
			    readonly nickname: string;
			    readonly __typename: "User";
			}) | ({
			    readonly __typename: "non-exhaustive; don't match this";
			}));

			export type MyFragmentInterfaceA$artifact = {
			    "name": "MyFragmentInterfaceA";
			    "kind": "HoudiniFragment";
			    "hash": "c62ecd0fa51af5f2bc2dc73b2a60a2c58a2b6ac417e2f6ceda865ac0642b522c";
			    "raw": \`fragment MyFragmentInterfaceA on Node {
			  ... on User {
			    nickname
			    id
			  }
			  id
			  __typename
			}
			\`;
			    "rootType": "Node";
			    "selection": {
			        "abstractFields": {
			            "fields": {
			                "User": {
			                    "nickname": {
			                        "type": "String";
			                        "keyRaw": "nickname";
			                        "directives": [{
			                            "name": "required";
			                            "arguments": {};
			                        }];
			                        "nullable": false;
			                        "required": true;
			                        "visible": true;
			                    };
			                    "id": {
			                        "type": "ID";
			                        "keyRaw": "id";
			                        "visible": true;
			                    };
			                    "__typename": {
			                        "type": "String";
			                        "keyRaw": "__typename";
			                        "visible": true;
			                    };
			                };
			            };
			            "typeMap": {};
			        };
			        "fields": {
			            "id": {
			                "type": "ID";
			                "keyRaw": "id";
			                "visible": true;
			            };
			            "__typename": {
			                "type": "String";
			                "keyRaw": "__typename";
			                "visible": true;
			            };
			        };
			    };
			    "pluginData": {};
			};
		`)
	})

	test('exhaustive inline fragment does not have {} in union', async function () {
		// the document to test
		const doc = mockCollectedDoc(`
			fragment MyFragmentA on Entity {
				... on User {
					id
				}
				... on Cat {
					id
				}
			}
		`)

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
			export type MyFragmentA$input = {};

			export type MyFragmentA = {
			    readonly "shape"?: MyFragmentA$data;
			    readonly " $fragments": {
			        "MyFragmentA": any;
			    };
			};

			export type MyFragmentA$data = {} & (({
			    readonly id: string;
			    readonly __typename: "User";
			}) | ({
			    readonly id: string;
			    readonly __typename: "Cat";
			}));

			export type MyFragmentA$artifact = {
			    "name": "MyFragmentA";
			    "kind": "HoudiniFragment";
			    "hash": "e9d884df80d3f9867417dfb64d809dbed3d47b9a63928d1352db47aeff24898f";
			    "raw": \`fragment MyFragmentA on Entity {
			  ... on User {
			    id
			  }
			  ... on Cat {
			    id
			  }
			  __typename
			}
			\`;
			    "rootType": "Entity";
			    "selection": {
			        "abstractFields": {
			            "fields": {
			                "User": {
			                    "id": {
			                        "type": "ID";
			                        "keyRaw": "id";
			                        "visible": true;
			                    };
			                    "__typename": {
			                        "type": "String";
			                        "keyRaw": "__typename";
			                        "visible": true;
			                    };
			                };
			                "Cat": {
			                    "id": {
			                        "type": "ID";
			                        "keyRaw": "id";
			                        "visible": true;
			                    };
			                    "__typename": {
			                        "type": "String";
			                        "keyRaw": "__typename";
			                        "visible": true;
			                    };
			                };
			            };
			            "typeMap": {};
			        };
			        "fields": {
			            "__typename": {
			                "type": "String";
			                "keyRaw": "__typename";
			                "visible": true;
			            };
			        };
			    };
			    "pluginData": {};
			};
		`)
		expect(fileContents!).not.toContain('non-exhaustive')
	})

	test('exhaustive inline fragment with @required does have {} in union', async function () {
		// the document to test
		const doc = mockCollectedDoc(`
			fragment MyFragmentA on Entity {
				... on User {
					nickname @required
				}
				... on Cat {
					nickname @required
				}
			}
		`)

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
			export type MyFragmentA$input = {};

			export type MyFragmentA = {
			    readonly "shape"?: MyFragmentA$data;
			    readonly " $fragments": {
			        "MyFragmentA": any;
			    };
			};

			export type MyFragmentA$data = {} & (({
			    readonly nickname: string;
			    readonly __typename: "User";
			}) | ({
			    readonly nickname: string;
			    readonly __typename: "Cat";
			}) | ({
			    readonly __typename: "non-exhaustive; don't match this";
			}));

			export type MyFragmentA$artifact = {
			    "name": "MyFragmentA";
			    "kind": "HoudiniFragment";
			    "hash": "ddfa83368ff067f75465fa482f1b76293ddfc22024fd6e992fd5b9cb73bbf69f";
			    "raw": \`fragment MyFragmentA on Entity {
			  ... on User {
			    nickname
			    id
			  }
			  ... on Cat {
			    nickname
			    id
			  }
			  __typename
			}
			\`;
			    "rootType": "Entity";
			    "selection": {
			        "abstractFields": {
			            "fields": {
			                "User": {
			                    "nickname": {
			                        "type": "String";
			                        "keyRaw": "nickname";
			                        "directives": [{
			                            "name": "required";
			                            "arguments": {};
			                        }];
			                        "nullable": false;
			                        "required": true;
			                        "visible": true;
			                    };
			                    "id": {
			                        "type": "ID";
			                        "keyRaw": "id";
			                        "visible": true;
			                    };
			                    "__typename": {
			                        "type": "String";
			                        "keyRaw": "__typename";
			                        "visible": true;
			                    };
			                };
			                "Cat": {
			                    "nickname": {
			                        "type": "String";
			                        "keyRaw": "nickname";
			                        "directives": [{
			                            "name": "required";
			                            "arguments": {};
			                        }];
			                        "nullable": false;
			                        "required": true;
			                        "visible": true;
			                    };
			                    "id": {
			                        "type": "ID";
			                        "keyRaw": "id";
			                        "visible": true;
			                    };
			                    "__typename": {
			                        "type": "String";
			                        "keyRaw": "__typename";
			                        "visible": true;
			                    };
			                };
			            };
			            "typeMap": {};
			        };
			        "fields": {
			            "__typename": {
			                "type": "String";
			                "keyRaw": "__typename";
			                "visible": true;
			            };
			        };
			    };
			    "pluginData": {};
			};
		`)
		expect(fileContents!).toContain('non-exhaustive')
	})

	test('non-exhaustive inline fragment does have {} in union', async function () {
		// the document to test
		const doc = mockCollectedDoc(`
			fragment MyFragmentA on Entity {
				... on User {
					id
				}
				# Cat is missing
			}
		`)

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
			export type MyFragmentA$input = {};

			export type MyFragmentA = {
			    readonly "shape"?: MyFragmentA$data;
			    readonly " $fragments": {
			        "MyFragmentA": any;
			    };
			};

			export type MyFragmentA$data = {} & (({
			    readonly id: string;
			    readonly __typename: "User";
			}) | ({
			    readonly __typename: "non-exhaustive; don't match this";
			}));

			export type MyFragmentA$artifact = {
			    "name": "MyFragmentA";
			    "kind": "HoudiniFragment";
			    "hash": "36d5feb08afa95a2fb6784486f3fec8c92dfbeb2cf8602d365f55700c2a3ebec";
			    "raw": \`fragment MyFragmentA on Entity {
			  ... on User {
			    id
			  }
			  __typename
			}
			\`;
			    "rootType": "Entity";
			    "selection": {
			        "abstractFields": {
			            "fields": {
			                "User": {
			                    "id": {
			                        "type": "ID";
			                        "keyRaw": "id";
			                        "visible": true;
			                    };
			                    "__typename": {
			                        "type": "String";
			                        "keyRaw": "__typename";
			                        "visible": true;
			                    };
			                };
			            };
			            "typeMap": {};
			        };
			        "fields": {
			            "__typename": {
			                "type": "String";
			                "keyRaw": "__typename";
			                "visible": true;
			            };
			        };
			    };
			    "pluginData": {};
			};
		`)
		expect(fileContents!).toContain('non-exhaustive')
	})

	test.todo('fragments on interfaces')

	test.todo('intersections with __typename in subselection')

	test.todo('inline fragments')
})

test('overlapping fragments', async function () {
	const configWithoutMasking = testConfig({
		defaultFragmentMasking: 'disable',
		schema: config.schema,
	})

	const docs = [
		mockCollectedDoc(`
			fragment UserBase on User {
				id
				firstName
				...UserMore
			}
		`),
		mockCollectedDoc(`
			fragment UserMore on User {
				id
				firstName
			}
		`),
	]

	// execute the generator
	await runPipeline(configWithoutMasking, docs)

	// look up the files in the artifact directory
	const fragmentFileContents = await fs.readFile(
		configWithoutMasking.artifactTypePath(docs[0].document)
	)

	expect(
		recast.parse(fragmentFileContents!, {
			parser: typeScriptParser,
		})
	).toMatchInlineSnapshot(`
		export type UserBase$input = {};

		export type UserBase = {
		    readonly "shape"?: UserBase$data;
		    readonly " $fragments": {
		        "UserBase": any;
		    };
		};

		export type UserBase$data = {
		    readonly id: string;
		    readonly firstName: string;
		    readonly " $fragments": {
		        UserMore: {};
		    };
		};

		export type UserBase$artifact = {
		    "name": "UserBase";
		    "kind": "HoudiniFragment";
		    "hash": "15225d2e5cba866e1a588cd399a03d5b2124156ac7003d3510544f22b7b9262c";
		    "raw": \`fragment UserBase on User {
		  id
		  firstName
		  ...UserMore
		  __typename
		}

		fragment UserMore on User {
		  id
		  firstName
		  __typename
		}
		\`;
		    "rootType": "User";
		    "selection": {
		        "fields": {
		            "id": {
		                "type": "ID";
		                "keyRaw": "id";
		                "visible": true;
		            };
		            "firstName": {
		                "type": "String";
		                "keyRaw": "firstName";
		                "visible": true;
		            };
		            "__typename": {
		                "type": "String";
		                "keyRaw": "__typename";
		                "visible": true;
		            };
		        };
		        "fragments": {
		            "UserMore": {
		                "arguments": {};
		            };
		        };
		    };
		    "pluginData": {};
		};
	`)
})

test('componentField scalars', async function () {
	const configWithoutMasking = testConfig({
		defaultFragmentMasking: 'disable',
		schema: config.schema,
	})

	const docs = [
		mockCollectedDoc(`
			fragment UserBase on User @componentField(field: "Avatar", prop: "user") {
				id
				firstName
			}
		`),
		mockCollectedDoc(`
			query UserList {
				users {
					Avatar
				}
			}
		`),
	]

	// execute the generator
	await runPipeline(configWithoutMasking, docs)

	// look up the files in the artifact directory
	const queryFileContents = await fs.readFile(
		configWithoutMasking.artifactTypePath(docs[1].document)
	)
	expect(
		recast.parse(queryFileContents!, {
			parser: typeScriptParser,
		})
	).toMatchInlineSnapshot(`
		import __component__UserBase from "../../UserBase";

		export type UserList = {
		    readonly "input": UserList$input;
		    readonly "result": UserList$result | undefined;
		};

		export type UserList$result = {
		    readonly users: ({
		        readonly Avatar: (props: Omit<Parameters<typeof __component__UserBase>[0], "user">) => ReturnType<typeof __component__UserBase>;
		    } | null)[] | null;
		};

		export type UserList$input = null;

		export type UserList$artifact = {
		    "name": "UserList";
		    "kind": "HoudiniQuery";
		    "hash": "775ef37f0ec8b8fbace7d66b5e5f3d01bada17c0930e4dc2f54c1eda379ca8dd";
		    "raw": \`query UserList {
		  users {
		    ...UserBase
		    id
		  }
		}

		fragment UserBase on User {
		  id
		  firstName
		  __typename
		}
		\`;
		    "rootType": "Query";
		    "selection": {
		        "fields": {
		            "users": {
		                "type": "User";
		                "keyRaw": "users";
		                "nullable": true;
		                "selection": {
		                    "fields": {
		                        "id": {
		                            "type": "ID";
		                            "keyRaw": "id";
		                            "visible": true;
		                        };
		                        "firstName": {
		                            "type": "String";
		                            "keyRaw": "firstName";
		                            "visible": true;
		                        };
		                        "__typename": {
		                            "type": "String";
		                            "keyRaw": "__typename";
		                            "visible": true;
		                        };
		                        "Avatar": {
		                            "keyRaw": "Avatar";
		                            "type": "Component";
		                            "component": {
		                                "prop": "user";
		                                "key": "User.Avatar";
		                                "fragment": "UserBase";
		                                "variables": {};
		                            };
		                            "visible": true;
		                        };
		                    };
		                    "fragments": {
		                        "UserBase": {
		                            "arguments": {};
		                        };
		                    };
		                };
		                "visible": true;
		            };
		        };
		    };
		    "pluginData": {};
		    "hasComponents": true;
		    "policy": "CacheOrNetwork";
		    "partial": false;
		};
	`)
})
