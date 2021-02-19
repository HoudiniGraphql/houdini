// externals
import * as graphql from 'graphql'
// locals
import { CompiledFragmentKind } from 'houdini-compiler'
import selector from './selector'
import { testConfig } from 'houdini-common'
import '../../../../jest.setup'

// declare a schema we will use
const config = testConfig({
	schema: `
        type User {
            name: String!
            age: Int!
            parent: User!
            friends: [User!]!
        }

        type Query { 
            users(stringKey: String, boolKey: Boolean, variableKey: String, intKey: Int, floatKey: Float): [User!]!
        }
    `,
})

describe('selector', function () {
	test('flat object', function () {
		const result = selectorTest(`fragment foo on User {
                name
                age
            }`)

		expect(result).toMatchInlineSnapshot(`
		(obj, variables) => {
		    return {
		        "__ref": obj.__ref,
		        "__variables": variables,
		        "name": obj.__ref.name,
		        "age": obj.__ref.age
		    };
		}
	`)
	})

	test('inline fragments', function () {
		const result = selectorTest(`fragment foo on User {
                name
                ... on User {
                    age
                }
            }`)

		expect(result).toMatchInlineSnapshot(`
		(obj, variables) => {
		    return {
		        "__ref": obj.__ref,
		        "__variables": variables,
		        "name": obj.__ref.name,
		        "age": obj.__ref.age
		    };
		}
	`)
	})

	test('related objects', function () {
		const result = selectorTest(`fragment foo on User {
                name
                parent {
                    name
                    age
                }
            }`)

		expect(result).toMatchInlineSnapshot(`
		(obj, variables) => {
		    return {
		        "__ref": obj.__ref,
		        "__variables": variables,
		        "name": obj.__ref.name,

		        "parent": {
		            "__ref": obj.__ref.parent.__ref,
		            "__variables": variables,
		            "name": obj.__ref.parent.__ref.name,
		            "age": obj.__ref.parent.__ref.age
		        }
		    };
		}
	`)
	})

	test('related lists', function () {
		const result = selectorTest(`fragment foo on User {
                name
                friends {
                    name
                    age
                }
            }`)

		expect(result).toMatchInlineSnapshot(`
		(obj, variables) => {
		    return {
		        "__ref": obj.__ref,
		        "__variables": variables,
		        "name": obj.__ref.name,

		        "friends": obj.__ref.friends.map(obj_friends => {
		            return {
		                "__ref": obj_friends.__ref,
		                "__variables": variables,
		                "name": obj_friends.__ref.name,
		                "age": obj_friends.__ref.age
		            };
		        })
		    };
		}
	`)
	})

	test('query selector', function () {
		const result = selectorTest(
			`fragment foo on User {
                name
                parent {
                    name
                    age
                }
                friends {
                    name
                    age
                }
            }`,
			{ pullValuesFromRef: false }
		)

		expect(result).toMatchInlineSnapshot(`
		(obj, variables) => {
		    return {
		        "__ref": obj,
		        "__variables": variables,
		        "name": obj.name,

		        "parent": {
		            "__ref": obj.parent,
		            "__variables": variables,
		            "name": obj.parent.name,
		            "age": obj.parent.age
		        },

		        "friends": obj.friends.map(obj_friends => {
		            return {
		                "__ref": obj_friends,
		                "__variables": variables,
		                "name": obj_friends.name,
		                "age": obj_friends.age
		            };
		        })
		    };
		}
	`)
	})

	test('connection arguments', function () {
		const result = selectorTest(
			`query {
            users(stringKey: "StringValue", boolKey: true, variableKey: $hello, intKey: 1, floatKey: 1.2) @connection(name: "Test") {
                name
            }
        }`,
			{
				rootType: config.schema.getQueryType(),
			}
		)

		expect(result).toMatchInlineSnapshot(`
		(obj, variables) => {
		    return {
		        "__ref": obj.__ref,
		        "__variables": variables,

		        "users": obj.__ref.users.map(obj_users => {
		            return {
		                "__ref": obj_users.__ref,
		                "__variables": variables,
		                "name": obj_users.__ref.name
		            };
		        })
		    };
		}
	`)
	})

	test('nested objects', function () {
		const result = selectorTest(`fragment foo on User {
                name
                parent {
                    name
                    age
                    parent {
                        name
                        age
                    }
                }
            }`)

		expect(result).toMatchInlineSnapshot(`
		(obj, variables) => {
		    return {
		        "__ref": obj.__ref,
		        "__variables": variables,
		        "name": obj.__ref.name,

		        "parent": {
		            "__ref": obj.__ref.parent.__ref,
		            "__variables": variables,
		            "name": obj.__ref.parent.__ref.name,
		            "age": obj.__ref.parent.__ref.age,

		            "parent": {
		                "__ref": obj.__ref.parent.__ref.parent.__ref,
		                "__variables": variables,
		                "name": obj.__ref.parent.__ref.parent.__ref.name,
		                "age": obj.__ref.parent.__ref.parent.__ref.age
		            }
		        }
		    };
		}
	`)
	})

	test('nested lists', function () {
		const result = selectorTest(`fragment foo on User {
                name
                friends {
                    name
                    age

                    friends {
                        name
                        age
                    }
                }
            }`)

		expect(result).toMatchInlineSnapshot(`
		(obj, variables) => {
		    return {
		        "__ref": obj.__ref,
		        "__variables": variables,
		        "name": obj.__ref.name,

		        "friends": obj.__ref.friends.map(obj_friends => {
		            return {
		                "__ref": obj_friends.__ref,
		                "__variables": variables,
		                "name": obj_friends.__ref.name,
		                "age": obj_friends.__ref.age,

		                "friends": obj_friends.__ref.friends.map(obj_friends_friends => {
		                    return {
		                        "__ref": obj_friends_friends.__ref,
		                        "__variables": variables,
		                        "name": obj_friends_friends.__ref.name,
		                        "age": obj_friends_friends.__ref.age
		                    };
		                })
		            };
		        })
		    };
		}
	`)
	})

	test('list in object', function () {
		const result = selectorTest(`fragment foo on User {
                name
                parent {
                    name
                    age

                    friends {
                        name
                        age
                    }
                }
            }`)

		expect(result).toMatchInlineSnapshot(`
		(obj, variables) => {
		    return {
		        "__ref": obj.__ref,
		        "__variables": variables,
		        "name": obj.__ref.name,

		        "parent": {
		            "__ref": obj.__ref.parent.__ref,
		            "__variables": variables,
		            "name": obj.__ref.parent.__ref.name,
		            "age": obj.__ref.parent.__ref.age,

		            "friends": obj.__ref.parent.__ref.friends.map(obj_parent_friends => {
		                return {
		                    "__ref": obj_parent_friends.__ref,
		                    "__variables": variables,
		                    "name": obj_parent_friends.__ref.name,
		                    "age": obj_parent_friends.__ref.age
		                };
		            })
		        }
		    };
		}
	`)
	})
})

function selectorTest(doc: string, extraConfig?: {}) {
	// parse the fragment
	const parsedFragment = graphql.parse(doc).definitions[0] as graphql.FragmentDefinitionNode

	// generate the selector
	return selector({
		config,
		artifact: {
			name: 'testFragment',
			kind: CompiledFragmentKind,
			raw: doc,
			hash: 'asf',
		},
		rootIdentifier: 'obj',
		rootType: config.schema.getType('User') as graphql.GraphQLObjectType,
		selectionSet: parsedFragment.selectionSet,
		root: true,
		...extraConfig,
	})
}
