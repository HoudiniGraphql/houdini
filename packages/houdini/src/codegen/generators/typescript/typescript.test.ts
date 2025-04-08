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
			    "hash": "41ed3aeda1667f41f70350748fd889ff611db8d9d2a733616d4b009a02cd44ee";
			    "raw": \`fragment TestFragment on User {
			  firstName
			  nickname
			  enumValue
			  id
			  __typename
			}\`;
			    "rootType": "User";
			    "stripVariables": [];
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
			    "hash": "a35478bbc644887e0bb8103f83120f814390a64c4eaaeae4be2e0a77f7b43e8c";
			    "raw": \`fragment TestFragment on Query {
			  user(id: $name) {
			    age
			    id
			  }
			  __typename
			}\`;
			    "rootType": "Query";
			    "stripVariables": [];
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
			        "defaults": {};
			        "runtimeScalars": {};
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
			    "hash": "a35478bbc644887e0bb8103f83120f814390a64c4eaaeae4be2e0a77f7b43e8c";
			    "raw": \`fragment TestFragment on Query {
			  user(id: $name) {
			    age
			    id
			  }
			  __typename
			}\`;
			    "rootType": "Query";
			    "stripVariables": [];
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
			        "defaults": {};
			        "runtimeScalars": {};
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
			    "hash": "925e2f135c7473e9eeef45213a91253c4d38e57567e231c7a76b3d2d1f7ba15e";
			    "raw": \`fragment TestFragment on User {
			  firstName
			  parent {
			    firstName
			    id
			  }
			  id
			  __typename
			}\`;
			    "rootType": "User";
			    "stripVariables": [];
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
			    "hash": "05be3633622d3c770395d2d776fbf5f94353e9fe95de6ecf121f02ae4839741e";
			    "raw": \`fragment TestFragment on User {
			  firstName
			  admin
			  age
			  id
			  weight
			  __typename
			}\`;
			    "rootType": "User";
			    "stripVariables": [];
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
			    "hash": "3731d101bb5a9fc07c54e1e3b62bd0c18b9c773c2f5f4d6662bfa0da487ff0b7";
			    "raw": \`fragment TestFragment on User {
			  firstName
			  friends {
			    firstName
			    id
			  }
			  id
			  __typename
			}\`;
			    "rootType": "User";
			    "stripVariables": [];
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
			    "hash": "2a4df9f83db3a5177292924dccd6241243e0e38e5457352d3b51718c37349db7";
			    "raw": \`query MyQuery {
			  user {
			    firstName
			    id
			  }
			}\`;
			    "rootType": "Query";
			    "stripVariables": [];
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
			    "hash": "deb1f2e71ee003e9bd0c59537841642b9518ab24f32b6bcba1881f9e50403597";
			    "raw": \`query MyQuery {
			  users {
			    firstName
			    id
			  }
			}\`;
			    "rootType": "Query";
			    "stripVariables": [];
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
			    "hash": "c2ba504f067ef622716e1390995c1e23f41e0d101dd78739caa94e04517b7c89";
			    "raw": \`query MyQuery($id: ID!, $enum: MyEnum) {
			  user(id: $id, enumArg: $enum) {
			    firstName
			    id
			  }
			}\`;
			    "rootType": "Query";
			    "stripVariables": [];
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
			        "defaults": {};
			        "runtimeScalars": {};
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
			    "hash": "fbd3fd8bc96a6a3d1cb83d54996128258ce52cef1f129de4d1b558ac3c289b5c";
			    "raw": \`query MyTestQuery {
			  entity {
			    ... on Node {
			      id
			    }
			    __typename
			  }
			}\`;
			    "rootType": "Query";
			    "stripVariables": [];
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
			    "hash": "43d2d7ea422de93873be8955fde91b181153393b75f35bcea4187d55cbba8082";
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
			}\`;
			    "rootType": "Mutation";
			    "stripVariables": [];
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
			        "defaults": {};
			        "runtimeScalars": {};
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
			    "hash": "b66a64c9983a9a057eecd801afbbbe3c33ea08d9a5f5018becff87a37f5c8403";
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
			}\`;
			    "rootType": "Mutation";
			    "stripVariables": [];
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
			    "hash": "643b644016807a188e7e008b9c9fcb092c648b7dd4afc21108af71a28c316140";
			    "raw": \`query MyQuery($filter: UserFilter!) {
			  user(filter: $filter) {
			    firstName
			    id
			  }
			}\`;
			    "rootType": "Query";
			    "stripVariables": [];
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
			        "defaults": {};
			        "runtimeScalars": {};
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
			    "hash": "40bde3bdbf85b31185e48e207726b76dc7ceaf538db7b69f0276eeb3f5be45c1";
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
			}\`;
			    "rootType": "Query";
			    "stripVariables": [];
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
			    /**
			     * Get a user.
			    */
			    readonly user: {
			        /**
			         * 
			         * @deprecated Use name instead
			        */
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
			    "hash": "40bde3bdbf85b31185e48e207726b76dc7ceaf538db7b69f0276eeb3f5be45c1";
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
			}\`;
			    "rootType": "Query";
			    "stripVariables": [];
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
			    "hash": "64e07e68d6da6f9414c6c4a2e20f45c02099169e71f2511eec493e8d6ba8356a";
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
			}\`;
			    "rootType": "Query";
			    "stripVariables": [];
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
			    "hash": "9521c4f7eaff8274d3687f408a4bcda455a702222bdb585beec6f453f00afcac";
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
			}\`;
			    "rootType": "Query";
			    "stripVariables": [];
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
			    "hash": "51e30f91409e4be787675716c351ee93af23a447eaa6cd2dc2fc0db119b88e19";
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
			}\`;
			    "rootType": "Query";
			    "stripVariables": [];
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
			    "hash": "d611ef43737097473f7965a5761feb626125e7a6ec64ab27245bf07488ae34f8";
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
			}\`;
			    "rootType": "Query";
			    "stripVariables": [];
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
			    "hash": "046ab23c2613444e9e84496b78b31a1c3e639a3459415053c9a1ea9ef2db4699";
			    "raw": \`query MyQuery {
			  allItems {
			    createdAt
			  }
			}\`;
			    "rootType": "Query";
			    "stripVariables": [];
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
			    "hash": "2fe84b673d47c7adc42816fe50de58f4097663fbe74cbb867c59530891a43d98";
			    "raw": \`query MyQuery($date: DateTime!) {
			  allItems(createdAt: $date) {
			    createdAt
			  }
			}\`;
			    "rootType": "Query";
			    "stripVariables": [];
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
			        "defaults": {};
			        "runtimeScalars": {};
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
			    "hash": "d90f665773767c623ed0425d680daff405fd9f3e598efb49c410409351675e8c";
			    "raw": \`query MyQuery {
			  listOfLists {
			    firstName
			    nickname
			    id
			  }
			}\`;
			    "rootType": "Query";
			    "stripVariables": [];
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
			    "hash": "5c318b0d09cb1cc59e89aa4826aac2c982e065d4c2d3b1428888fc3c956cba4d";
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
			}\`;
			    "rootType": "Query";
			    "stripVariables": [];
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
			    "hash": "57e2672d9f64384cd159814b5c8f5482feda22ab1a0d980b727235b2de0f7dde";
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
			}\`;
			    "rootType": "Mutation";
			    "stripVariables": [];
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
			        "defaults": {};
			        "runtimeScalars": {};
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
			    "hash": "bba4a703afd87c40d414c6b21f9561c063abafdf6fc229091587aaffb8f4011d",

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
			}\`,

			    "rootType": "Query",
			    "stripVariables": [],

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

			        "types": {},
			        "defaults": {},
			        "runtimeScalars": {}
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
			    "hash": "bf9b67917fc6ace870d237db01e46ec1c75c3b830aafecd875273a51d7308499";
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
			}\`;
			    "rootType": "Query";
			    "stripVariables": [];
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
			    "hash": "bf9b67917fc6ace870d237db01e46ec1c75c3b830aafecd875273a51d7308499";
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
			}\`;
			    "rootType": "Query";
			    "stripVariables": [];
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
			                                    "UserBase": {
			                                        "arguments": {};
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
			    "hash": "00043bc128bcccc27570fce87dbc1fb0549c22842dbcc1017130acbe0d78b372";
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
			}\`;
			    "rootType": "User";
			    "stripVariables": [];
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
			                        };
			                        "__typename": {
			                            "type": "String";
			                            "keyRaw": "__typename";
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
			    "hash": "bf9b67917fc6ace870d237db01e46ec1c75c3b830aafecd875273a51d7308499";
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
			}\`;
			    "rootType": "Query";
			    "stripVariables": [];
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
			    "hash": "00043bc128bcccc27570fce87dbc1fb0549c22842dbcc1017130acbe0d78b372";
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
			}\`;
			    "rootType": "User";
			    "stripVariables": [];
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
			    "hash": "433ca4a5ae5c4d20371e4e7ba4b67c4702828f79c8af1188805763940df2fe1b";
			    "raw": \`query MyQuery {
			  user {
			    id
			    firstName @include(if: true)
			    admin @skip(if: true)
			  }
			}\`;
			    "rootType": "Query";
			    "stripVariables": [];
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
			    "hash": "22c351c2fe68d3749be27efb60a0849c1618310b65d49d21179f09b9a012bfac";
			    "raw": \`query MyQuery {
			  user {
			    id
			    firstName
			    nickname
			  }
			}\`;
			    "rootType": "Query";
			    "stripVariables": [];
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
			    "hash": "3f758e37c3d418e17f7b7c37d41b1114256941c712c7971ce6a59671aad38270";
			    "raw": \`query MyQuery {
			  user {
			    parent {
			      id
			      firstName
			      nickname
			    }
			    id
			  }
			}\`;
			    "rootType": "Query";
			    "stripVariables": [];
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
			    "hash": "3f758e37c3d418e17f7b7c37d41b1114256941c712c7971ce6a59671aad38270";
			    "raw": \`query MyQuery {
			  user {
			    parent {
			      id
			      firstName
			      nickname
			    }
			    id
			  }
			}\`;
			    "rootType": "Query";
			    "stripVariables": [];
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
			    "hash": "c43ca416969c1205da2baaa685ef2fe450fe0c9f289d9acdec25283f6538d3cb";
			    "raw": \`query MyQuery {
			  user {
			    parentRequired {
			      id
			      firstName
			      nickname
			    }
			    id
			  }
			}\`;
			    "rootType": "Query";
			    "stripVariables": [];
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
			    "hash": "122d50f617ca93a7ec325f07cccb379b0213d9d61ffb6475b68f5a732d49217d";
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
			}\`;
			    "rootType": "User";
			    "stripVariables": [];
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
			    "hash": "01660889e0fce1ed6a0ebccb1716931947a7a072e184b4fc0d4c6979567c6e34";
			    "raw": \`fragment MyFragmentInterfaceA on Node {
			  ... on User {
			    nickname
			    id
			  }
			  id
			  __typename
			}\`;
			    "rootType": "Node";
			    "stripVariables": [];
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
			    "hash": "78b137a2bff2862a2a1ddd946e0c26e4905055c080ae447d0d0aed6c162cff5c";
			    "raw": \`fragment MyFragmentA on Entity {
			  ... on User {
			    id
			  }
			  ... on Cat {
			    id
			  }
			  __typename
			}\`;
			    "rootType": "Entity";
			    "stripVariables": [];
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
			    "hash": "0a8679cb4d5da1e3922c61825e71b061ba6269b255381f51e7f97d61ca62292f";
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
			}\`;
			    "rootType": "Entity";
			    "stripVariables": [];
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
			    "hash": "fff966f1480f676f5f28dda0b93b837b2b7532314232d1173236d7be6a48b4b8";
			    "raw": \`fragment MyFragmentA on Entity {
			  ... on User {
			    id
			  }
			  __typename
			}\`;
			    "rootType": "Entity";
			    "stripVariables": [];
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
		    "hash": "9b42e711c6a2c6963081878055088332491c172b2d746036a355db2d148fc1eb";
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
		}\`;
		    "rootType": "User";
		    "stripVariables": [];
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
		    "hash": "e2ed48f4842502ef1e6b3d4237cc375a769f090233af0b391fa3ea1a817819f1";
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
		}\`;
		    "rootType": "Query";
		    "stripVariables": [];
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
