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
			    "hash": "fec5e49042a021e67a5f04a339f3729793fedbf7df83c2119a6ad932f91727f8";
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
			    "hash": "03f5a3344390dfa1b642c7038bbdb5f6bfadbb645886b0d1ce658fc77e90668e";
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
			    "hash": "9c72207c02a37626ffd0f6397ab2a573d88486792caad6f52c785555a6a6343b";
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
			    "hash": "c05ae5e22dd26c00fbc088277ca96ded6e01a0a6c540eb040ee91d10655b4575";
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
			    "hash": "268c6ce8de2ed68662e4da519dc541b6aae4232671449895e23cee88b25120cd";
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
			    "hash": "60afdef644bced9aae26a086b7dbf33dc7b8b51c45ddc2fc4571a0bb72f2d660";
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
			    "hash": "75599daf9b89690cac0df70674158875f4908fd3405b0a12510bb0803161dd01";
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
			    "hash": "802f49d218bd0db35a4f4eec151e9db62490086a3e61818659f7a283548427b6";
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
			    "hash": "d4c90d48b80c460939fd7dca6b99122fdd276812c20176b37679cfaf08c2efcf";
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
			    "hash": "a628c9dfeecde5337a5439aee8f7c4d0111783f9fd456841a54f485db49f756d";
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
			                            "Cat": "Node";
			                            "User": "Node";
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
			    "hash": "ca24beb22d7dfdbf5e50bc7ca446037f0812deeca00c13d3ce745a9f492f69b7";
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
			    "hash": "32e4d8c37e92a71ccb13fe49e001735829f33af4f42687fb138c6547c4cc4749";
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
			                        "TestFragment": {};
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
			    "hash": "3db625201d1054e50b978a3a87dc954aef3b8284070cdd0c1f667a2ccada232f";
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
			    "hash": "e07594825d2da2a5eaae6efa277dc4dfd0f3416a08827dfc505c88a0c5650068";
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
			                        "Foo": {};
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
			    "hash": "e07594825d2da2a5eaae6efa277dc4dfd0f3416a08827dfc505c88a0c5650068";
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
			                        "Foo": {};
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
			    })))[];
			};

			export type MyQuery$input = null;

			export type MyQuery$artifact = {
			    "name": "MyQuery";
			    "kind": "HoudiniQuery";
			    "hash": "07886277853f6b1ef2d195030db19d20fc69006937a247cfebe208017c289335";
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
			    "hash": "b5705e689c230262aea65553c5366ca16aa85ffb6be532a5a83fe0c29319b632";
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
			    })))[];
			};

			export type MyQuery$input = null;

			export type MyQuery$artifact = {
			    "name": "MyQuery";
			    "kind": "HoudiniQuery";
			    "hash": "21a52db58ea979321a735e60ac37878e5675cc15589e1f54cd6ea8ad51a9c359";
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
			    "hash": "c25bd32ae0bce403ccc8003f26d309858560a9a931b3994b25ea90a5e78f12e3";
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
			                                "isAnimal": {
			                                    "type": "Boolean";
			                                    "keyRaw": "isAnimal";
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
			    "hash": "87075eb7baf6814d4d50014581034fbdaa8ba700214a568670261e5b428597a0";
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
			    "hash": "dabe70c216f3d5d1c8acddccf9e2d8b14257649861747f941b9c64cfd6311022";
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
			    "hash": "a173496c64d9d074e03787939bc79e046f8362a606857fa387447c5f3a250ab7";
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
			    "hash": "38d331a2d7f0611a5ed00d57a0f3b4ef5c5cde865f69cb1b09559db85211ea2e";
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
			    "hash": "609440bd4c48c2082cadf4d900ab6f3636c576ce469a14c00383896c0a093d36";
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
			                        "My_Users_remove": {};
			                        "My_Users_insert": {};
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
			    "hash": "53a8f654096f13904d5dc6300ce727748bf3ed0388e19984ef8ac7dc17515385";
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
			                                    "UserBase": {};
			                                };
			                            };
			                            "visible": true;
			                        };
			                    };
			                    "fragments": {
			                        "UserBase": {};
			                        "UserMore": {};
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
			    "hash": "c387cedf90314a9b3fb48a4d2f47ed1ba1c4e12e3da2eb9ac6fc1220adfa2e8d";
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
			                                "fragments": {
			                                    "UserBase": {};
			                                };
			                            };
			                        };
			                    };
			                    "fragments": {
			                        "UserBase": {};
			                        "UserMore": {};
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
			    "hash": "dd15a529e927b628fe52e5479f698a5b3a65bae59380ff08e767cfb8bdf1c745";
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
			                        "UserBase": {};
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
			    "hash": "ec1246bc6b1083a74cefb176a260fbc3171a820cffd8e9cd747cdce7488d3665";
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
			                                    "UserBase": {};
			                                };
			                            };
			                            "visible": true;
			                        };
			                    };
			                    "fragments": {
			                        "UserBase": {};
			                        "UserMore": {};
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
			    "hash": "dd15a529e927b628fe52e5479f698a5b3a65bae59380ff08e767cfb8bdf1c745";
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
			                        "UserBase": {};
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
			    "hash": "2d7de7172ca60367f8319c3e20c939584616da3953e8723a9c5bf55117a24897";
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
			    readonly __typename: "required field missing";
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
			    readonly __typename: "required field missing";
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
			    readonly __typename: "required field missing";
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
			    readonly __typename: "required field missing";
			}));
		`)
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
		    "hash": "05ec5090d31f77c3f2bdcbd26aff116588f63d4b3789ae752759dd172974a628";
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
		            "UserMore": {};
		        };
		    };
		    "pluginData": {};
		};
	`)
})
