import type { ProgramKind } from 'ast-types/gen/kinds'
import * as recast from 'recast'
import * as typeScriptParser from 'recast/parsers/typescript'
import { test, expect } from 'vitest'

import { runPipeline } from '../..'
import { fs, path } from '../../../lib'
import { testConfig } from '../../../test'

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
			name: String!
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

test('generates type definitions for the imperative API', async function () {
	// execute the generator
	await runPipeline(config, [])

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
		import { MyEnum } from "../graphql";

		export declare type CacheTypeDef = {
		    types: {
		        __ROOT__: {
		            idFields: {}
		            fields: {
		                user: {
		                    type: "User" | null
		                }
		                users: {
		                    list: "User" | null
		                    nullable: false
		                }
		                nodes: {
							vvvvv this needs to {be type: { list: .... }}
							vvvvv where does args go?
		                    list: "Cat" | "Ghost" | "User"
		                    nullable: true
		                }
		                entities: {
		                    list: "User" | "Cat" | null
		                    nullable: false
		                }
		                entity: {
		                    type: "User" | "Cat"
		                }
		                listOfLists: {
		                    list: "User"
		                    nullable: false
		                }
		                node: {
		                    type: "Cat" | "Ghost" | "User" | null
		                }
		            }
		        }
		        UserFilter: {
		            idFields: never
		            fields: {
		                middle: {
		                    type: "NestedUserFilter" | null
		                }
		                listRequired: {
		                    list: string
		                    nullable: true
		                }
		                nullList: {
		                    list: string | null
		                    nullable: false
		                }
		                recursive: {
		                    type: "UserFilter" | null
		                }
		                enum: {
		                    type: MyEnum | null
		                }
		            }
		        }
		        NestedUserFilter: {
		            idFields: never
		            fields: {
		                id: string
		                firstName: string
		                admin: boolean | null
		                age: number | null
		                weight: number | null
		            }
		        }
		        Cat: {
		            idFields: {
		                id: string
		            }
		            fields: {
		                id: string
		                kitty: boolean
		                isAnimal: boolean
		            }
		        }
		        Ghost: {
		            idFields: {
		                name: string
		                aka: string
		            }
		            fields: {
		                id: string
		                aka: string
		                name: string
		            }
		        }
		        User: {
		            idFields: {
		                id: string
		            }
		            fields: {
		                id: string
		                firstName: string
		                nickname: string | null
		                parent: {
		                    type: "User" | null
		                }
		                friends: {
		                    list: "User" | null
		                    nullable: false
		                }
		                enumValue: {
		                    type: MyEnum | null
		                }
		                admin: boolean | null
		                age: number | null
		                weight: number | null
		            }
		        }
		    }
		    lists: {}
		};
	`
	)
})
