// externals
import * as graphql from 'graphql'
// locals
import { CompiledFragmentKind } from 'houdini-compiler'
import selector from './selector'
import { testConfig } from 'houdini-common'
import '../../../../jest.setup'


describe('selector', function () {
    test('flat object', function() {
			const result = selectorTest(`fragment foo on User {
                name
                age
            }`)

            expect(result).toMatchInlineSnapshot()
})    
    
    test('inline fragments', function() {
			const result = selectorTest(`fragment foo on User {
                name
                ... on User {
                    age
                }
            }`)

            expect(result).toMatchInlineSnapshot()
})    
    
    test('related objects', function() {
			const result = selectorTest(`fragment foo on User {
                name
                parent {
                    name
                    age
                }
            }`)

            expect(result).toMatchInlineSnapshot()
})    
    
    test('related lists', function() {
			const result = selectorTest(`fragment foo on User {
                name
                friends {
                    name
                    age
                }
            }`)

            expect(result).toMatchInlineSnapshot()
})    
    
    test('query selector', function() {
			const result = selectorTest(`fragment foo on User {
                name
                parent {
                    name
                    age
                }
                friends {
                    name
                    age
                }
            }`, {pullValuesFromRef: false})

            expect(result).toMatchInlineSnapshot()})

    test('connection arguments', function() {
			const result = selectorTest(`query {
                foo(stringKey: "StringValue", boolKey: true, variableKey: $hello, intKey: 1, floatKey: 1.2) @connection(name: "Test")
            }`)

            expect(result).toMatchInlineSnapshot()})    
    
    test('nested objects', function() {
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

            expect(result).toMatchInlineSnapshot()
})    
    
    test('nested lists', function() {
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

            expect(result).toMatchInlineSnapshot()
})    
    
    test('list in object', function() {
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

            expect(result).toMatchInlineSnapshot()
})
    })

function selectorTest(doc:string, extraConfig?: {}) {
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
                users(stringKey: String, boolKey: Boolean, variableKey: String, intKey: Int, floatKey: Float)
            }
        `,
    })

    // parse the fragment
    const parsedFragment = graphql.parse(doc)
        .definitions[0] as graphql.FragmentDefinitionNode


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