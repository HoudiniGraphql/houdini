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
		import type { MyEnum } from "$houdini/graphql/enums";

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

		export declare type CacheTypeDef = {
		    types: {
		        __ROOT__: {
		            idFields: {}
		            fields: {
		                user: {
		                    type: {
		                        record: "User" | null
		                    }
		                    args: {
		                        id: string | null | undefined
		                        filter: UserFilter | null | undefined
		                        filterList: (UserFilter)[] | null | undefined
		                        enumArg: MyEnum | null | undefined
		                    }
		                }
		                users: {
		                    type: {
		                        list: "User" | null
		                        nullable: false
		                    }
		                    args: {
		                        filter: UserFilter | null | undefined
		                        list: (UserFilter)[]
		                        id: string
		                        firstName: string
		                        admin: boolean | null | undefined
		                        age: number | null | undefined
		                        weight: number | null | undefined
		                    }
		                }
		                nodes: {
		                    type: {
		                        list: "Cat" | "Ghost" | "User"
		                        nullable: true
		                    }
		                    args: never
		                }
		                entities: {
		                    type: {
		                        list: "User" | "Cat" | null
		                        nullable: false
		                    }
		                    args: never
		                }
		                entity: {
		                    type: {
		                        record: "User" | "Cat"
		                    }
		                    args: never
		                }
		                listOfLists: {
		                    type: {
		                        list: "User" | null
		                        nullable: true
		                    }
		                    args: never
		                }
		                node: {
		                    type: {
		                        record: "Cat" | "Ghost" | "User" | null
		                    }
		                    args: {
		                        id: string
		                    }
		                }
		            }
		        }
		        Cat: {
		            idFields: {
		                id: string
		            }
		            fields: {
		                id: {
		                    type: string
		                    args: never
		                }
		                kitty: {
		                    type: boolean
		                    args: never
		                }
		                isAnimal: {
		                    type: boolean
		                    args: never
		                }
		                names: {
		                    type: (string | null)[]
		                    args: never
		                }
		            }
		        }
		        Ghost: {
		            idFields: {
		                name: string
		                aka: string
		            }
		            fields: {
		                id: {
		                    type: string
		                    args: never
		                }
		                aka: {
		                    type: string
		                    args: never
		                }
		                name: {
		                    type: string
		                    args: never
		                }
		            }
		        }
		        User: {
		            idFields: {
		                id: string
		            }
		            fields: {
		                id: {
		                    type: string
		                    args: never
		                }
		                firstName: {
		                    type: string
		                    args: never
		                }
		                nickname: {
		                    type: string | null
		                    args: never
		                }
		                parent: {
		                    type: {
		                        record: "User" | null
		                    }
		                    args: never
		                }
		                friends: {
		                    type: {
		                        list: "User" | null
		                        nullable: false
		                    }
		                    args: never
		                }
		                enumValue: {
		                    type: MyEnum | null
		                    args: never
		                }
		                admin: {
		                    type: boolean | null
		                    args: never
		                }
		                age: {
		                    type: number | null
		                    args: never
		                }
		                weight: {
		                    type: number | null
		                    args: never
		                }
		            }
		        }
		    }
		    lists: {}
		};
	`
	)
})
