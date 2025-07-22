import type { ProgramKind } from 'ast-types/lib/gen/kinds'
import * as recast from 'recast'
import * as typeScriptParser from 'recast/parsers/typescript'
import { test, expect } from 'vitest'

import { runPipeline } from '../..'
import { fs, path } from '../../../lib'
import { mockCollectedDoc, testConfig } from '../../../test'

const config = testConfig({
	schema: `
		enum MyEnum {
			Hello
		}

		type Query {
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

		type User implements Node {
			id: ID!

			firstName(pattern: String): String!
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

test('generates type definitions for the imperative API', async function () {
	// execute the generator
	await runPipeline(config, [
		mockCollectedDoc(
			`query TestQuery {
					users(
						id: "1"
						firstName: "hello"
						list: []
					) @list(name: "All_Users") {
						firstName
					}
				}
			`
		),
		mockCollectedDoc(
			`query TestQueryNoArgs {
					entities @list(name: "NoArgs") {
						... on User {
							firstName
						}
					}
				}
			`
		),
		mockCollectedDoc(
			`fragment UserInfo on User {
					firstName
				}
			`
		),
		mockCollectedDoc(
			`fragment UserInfoWithArguments on User
				@arguments(pattern: { type: "String" })
				{
					firstName(pattern: $pattern)
				}
			`
		),
	])

	// open up the index file
	const fileContents = await fs.readFile(path.join(config.runtimeDirectory, 'generated.d.ts'))
	expect(fileContents).toBeTruthy()

	// parse the contents
	const parsedQuery: ProgramKind = recast.parse(fileContents!, {
		parser: typeScriptParser,
	}).program
	// verify contents
	expect(parsedQuery).toMatchInlineSnapshot(
		`
		import type { Record } from "./public/record";
		import { TestQueryNoArgs$result, TestQueryNoArgs$input } from "../artifacts/TestQueryNoArgs";
		import { TestQuery$result, TestQuery$input } from "../artifacts/TestQuery";
		import type { ValueOf } from "$houdini/runtime/lib/types";
		import type { MyEnum } from "$houdini/graphql/enums";
		import { UserInfoWithArguments$input } from "../artifacts/UserInfoWithArguments";
		import { UserInfoWithArguments$data } from "../artifacts/UserInfoWithArguments";
		import { UserInfo$data } from "../artifacts/UserInfo";

		type NestedUserFilter = {
		    id: string | number;
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

		export declare type CacheTypeDef = {
		    types: {
		        __ROOT__: {
		            idFields: {};
		            fields: {
		                user: {
		                    type: Record<CacheTypeDef, "User"> | null;
		                    args: {
		                        id?: string | number | null | undefined;
		                        filter?: UserFilter | null | undefined;
		                        filterList?: (UserFilter)[] | null | undefined;
		                        enumArg?: ValueOf<typeof MyEnum> | null | undefined;
		                    };
		                };
		                users: {
		                    type: ((Record<CacheTypeDef, "User"> | null))[] | null;
		                    args: {
		                        filter?: UserFilter | null | undefined;
		                        list: (UserFilter)[];
		                        id: string | number;
		                        firstName: string;
		                        admin?: boolean | null | undefined;
		                        age?: number | null | undefined;
		                        weight?: number | null | undefined;
		                    };
		                };
		                nodes: {
		                    type: (Record<CacheTypeDef, "Cat"> | Record<CacheTypeDef, "Ghost"> | Record<CacheTypeDef, "User">)[];
		                    args: never;
		                };
		                entities: {
		                    type: ((Record<CacheTypeDef, "User"> | Record<CacheTypeDef, "Cat"> | null))[] | null;
		                    args: never;
		                };
		                entity: {
		                    type: Record<CacheTypeDef, "User"> | Record<CacheTypeDef, "Cat">;
		                    args: never;
		                };
		                listOfLists: {
		                    type: ((((Record<CacheTypeDef, "User"> | null))[] | null))[];
		                    args: never;
		                };
		                node: {
		                    type: Record<CacheTypeDef, "Cat"> | Record<CacheTypeDef, "Ghost"> | Record<CacheTypeDef, "User"> | null;
		                    args: {
		                        id: string | number;
		                    };
		                };
		            };
		            fragments: [];
		        };
		        Cat: {
		            idFields: {
		                id: string;
		            };
		            fields: {
		                id: {
		                    type: string;
		                    args: never;
		                };
		                kitty: {
		                    type: boolean;
		                    args: never;
		                };
		                isAnimal: {
		                    type: boolean;
		                    args: never;
		                };
		                names: {
		                    type: ((string | null))[];
		                    args: never;
		                };
		            };
		            fragments: [];
		        };
		        Ghost: {
		            idFields: {
		                name: string;
		                aka: string;
		            };
		            fields: {
		                id: {
		                    type: string;
		                    args: never;
		                };
		                aka: {
		                    type: string;
		                    args: never;
		                };
		                name: {
		                    type: string;
		                    args: never;
		                };
		            };
		            fragments: [];
		        };
		        User: {
		            idFields: {
		                id: string;
		            };
		            fields: {
		                id: {
		                    type: string;
		                    args: never;
		                };
		                firstName: {
		                    type: string;
		                    args: {
		                        pattern?: string | null | undefined;
		                    };
		                };
		                nickname: {
		                    type: string | null;
		                    args: never;
		                };
		                parent: {
		                    type: Record<CacheTypeDef, "User"> | null;
		                    args: never;
		                };
		                friends: {
		                    type: ((Record<CacheTypeDef, "User"> | null))[] | null;
		                    args: never;
		                };
		                enumValue: {
		                    type: MyEnum | null;
		                    args: never;
		                };
		                admin: {
		                    type: boolean | null;
		                    args: never;
		                };
		                age: {
		                    type: number | null;
		                    args: never;
		                };
		                weight: {
		                    type: number | null;
		                    args: never;
		                };
		            };
		            fragments: [[any, UserInfo$data, never], [any, UserInfoWithArguments$data, UserInfoWithArguments$input]];
		        };
		    };
		    lists: {
		        All_Users: {
		            types: "User";
		            filters: {
		                filter?: UserFilter | null | undefined;
		                list?: (UserFilter)[];
		                id?: string | number;
		                firstName?: string;
		                admin?: boolean | null | undefined;
		                age?: number | null | undefined;
		                weight?: number | null | undefined;
		            };
		        };
		        NoArgs: {
		            types: "User" | "Cat";
		            filters: never;
		        };
		    };
		    queries: [[any, TestQuery$result, TestQuery$input], [any, TestQueryNoArgs$result, TestQueryNoArgs$input]];
		};
	`
	)
})
