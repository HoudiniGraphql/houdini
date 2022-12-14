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
		                    type: {
		                        record: "User" | null
		                    }
		                    args: never
		                }
		                users: {
		                    type: {
		                        list: "User" | null
		                        nullable: false
		                    }
		                    args: never
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
		                        list: "User"
		                        nullable: false
		                    }
		                    args: never
		                }
		                node: {
		                    type: {
		                        record: "Cat" | "Ghost" | "User" | null
		                    }
		                    args: never
		                }
		            }
		        }
		        UserFilter: {
		            idFields: never
		            fields: {
		                middle: {
		                    type: {
		                        record: "NestedUserFilter" | null
		                    }
		                    args: never
		                }
		                listRequired: {
		                    type: {
		                        list: string
		                        nullable: true
		                    }
		                    args: never
		                }
		                nullList: {
		                    type: {
		                        list: string | null
		                        nullable: false
		                    }
		                    args: never
		                }
		                recursive: {
		                    type: {
		                        record: "UserFilter" | null
		                    }
		                    args: never
		                }
		                enum: {
		                    type: MyEnum | null
		                    args: never
		                }
		            }
		        }
		        NestedUserFilter: {
		            idFields: never
		            fields: {
		                id: {
		                    type: string
		                    args: never
		                }
		                firstName: {
		                    type: string
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
