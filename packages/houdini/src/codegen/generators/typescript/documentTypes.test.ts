import * as recast from 'recast'
import * as typescriptParser from 'recast/parsers/typescript'
import { expect, test } from 'vitest'

import { runPipeline } from '../..'
import { fs } from '../../../lib'
import { mockCollectedDoc, testConfig } from '../../../test'

const config = testConfig({
	schema: `
        """ Documentation of MyEnum """
		enum MyEnum {
            """Documentation of Hello"""
			Hello
		}

		type Query {
            """Get a user."""
			user(id: ID, filter: UserFilter, filterList: [UserFilter!], enumArg: MyEnum): User
			users(
				filter: UserFilter,
				list: [UserFilter!]!,
				id: ID!
				firstName: String!
				admin: Boolean
				age: Int
				weight: Float
			): [User]
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
			names: [String]!
		}


		interface Animal {
			isAnimal: Boolean!
		}

		union Entity = User | Cat

		union AnotherEntity = User | Ghost

		type Ghost implements Node {
			id: ID!
			aka: String!
			name: String!
		}

        """A user in the system"""
		type User implements Node {
			id: ID!

            """The user's first name"""
			firstName(pattern: String): String!
            """The user's first name"""
            firstname: String! @deprecated(reason: "Use firstName instead")
			nickname: String
			parent: User
			friends: [User]
            """An enum value"""
			enumValue: MyEnum

			admin: Boolean
			age: Int
			weight: Float
		}
    `,
})

test('generate document types', async function () {
	const documents = [
		mockCollectedDoc(`query TestQuery {
            user(id: "123") {
                firstName, admin, ...otherInfo, firstname
            }
        }`),
		mockCollectedDoc(`fragment otherInfo on User {
            enumValue, age, firstname
        }`),
	]
	await runPipeline(config, documents)

	const queryArtifactContents = await fs.readFile(config.artifactTypePath(documents[0].document))

	expect(
		recast.parse(queryArtifactContents!, {
			parser: typescriptParser,
		})
	).toMatchInlineSnapshot(`
		export type TestQuery = {
		    readonly "input": TestQuery$input;
		    readonly "result": TestQuery$result | undefined;
		};

		export type TestQuery$result = {
		    /**
		     * Get a user.
		    */
		    readonly user: {
		        /**
		         * The user's first name
		        */
		        readonly firstName: string;
		        readonly admin: boolean | null;
		        /**
		         * The user's first name
		         * @deprecated Use firstName instead
		        */
		        readonly firstname: string;
		        readonly " $fragments": {
		            otherInfo: {};
		        };
		    } | null;
		};

		export type TestQuery$input = null;

		export type TestQuery$artifact = {
		    "name": "TestQuery";
		    "kind": "HoudiniQuery";
		    "hash": "588d554d8d7839596a619c1bfeaae326f42eb416c17dfeb016bee8434fae6043";
		    "raw": \`query TestQuery {
		  user(id: "123") {
		    firstName
		    admin
		    ...otherInfo
		    firstname
		    id
		  }
		}

		fragment otherInfo on User {
		  enumValue
		  age
		  firstname
		  id
		  __typename
		}
		\`;
		    "rootType": "Query";
		    "selection": {
		        "fields": {
		            "user": {
		                "type": "User";
		                "keyRaw": "user(id: \\"123\\")";
		                "nullable": true;
		                "selection": {
		                    "fields": {
		                        "enumValue": {
		                            "type": "MyEnum";
		                            "keyRaw": "enumValue";
		                            "nullable": true;
		                        };
		                        "age": {
		                            "type": "Int";
		                            "keyRaw": "age";
		                            "nullable": true;
		                        };
		                        "firstname": {
		                            "type": "String";
		                            "keyRaw": "firstname";
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
		                    };
		                    "fragments": {
		                        "otherInfo": {
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

	const fragmentArtifactContents = await fs.readFile(
		config.artifactTypePath(documents[1].document)
	)

	expect(recast.parse(fragmentArtifactContents!, { parser: typescriptParser }))
		.toMatchInlineSnapshot(`
		import { MyEnum } from "$houdini/graphql/enums";
		import type { ValueOf } from "$houdini/runtime/lib/types";
		export type otherInfo$input = {};

		export type otherInfo = {
		    readonly "shape"?: otherInfo$data;
		    readonly " $fragments": {
		        "otherInfo": any;
		    };
		};

		export type otherInfo$data = {
		    /**
		     * An enum value
		    */
		    readonly enumValue: ValueOf<typeof MyEnum> | null;
		    readonly age: number | null;
		    /**
		     * The user's first name
		     * @deprecated Use firstName instead
		    */
		    readonly firstname: string;
		};

		export type otherInfo$artifact = {
		    "name": "otherInfo";
		    "kind": "HoudiniFragment";
		    "hash": "ea797186970659edb8c7a021812ce5652a9fb1d4ca5f6b9acde4e0aa734e0a3e";
		    "raw": \`fragment otherInfo on User {
		  enumValue
		  age
		  firstname
		  id
		  __typename
		}
		\`;
		    "rootType": "User";
		    "selection": {
		        "fields": {
		            "enumValue": {
		                "type": "MyEnum";
		                "keyRaw": "enumValue";
		                "nullable": true;
		                "visible": true;
		            };
		            "age": {
		                "type": "Int";
		                "keyRaw": "age";
		                "nullable": true;
		                "visible": true;
		            };
		            "firstname": {
		                "type": "String";
		                "keyRaw": "firstname";
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
