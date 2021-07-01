import * as graphql from 'graphql'
import { parentTypeFromAncestors } from './graphql'

test('can find ancestor from type', function () {
	// define a schema we'll test against
	const schema = graphql.buildSchema(`
        type User { 
            id: ID!
            name: String!
        }

        type Query { 
            users: [User!]!
        }
    `)

	const doc = graphql.parse(`
        query { 
            users { 
                id
            }
        }
    `)

	// we should
	let foundType = ''

	graphql.visit(doc, {
		Field(node, key, parent, path, ancestors) {
			if (node.name.value === 'id') {
				foundType = parentTypeFromAncestors(schema, ancestors).name
			}
		},
	})

	expect(foundType).toEqual('User')
})

test('can find interface ancestor from type', function () {
	// define a schema we'll test against
	const schema = graphql.buildSchema(`
        type User implements Node { 
            id: ID!
            name: String!
        }

        interface Node { 
            id: ID!
        }

        type Query { 
            nodes: [Node!]!
        }
    `)

	const doc = graphql.parse(`
        query { 
            nodes { 
                ... on User { 
                    id
                }
            }
        }
    `)

	// we should
	let foundType = ''

	graphql.visit(doc, {
		Field(node, key, parent, path, ancestors) {
			if (node.name.value === 'id') {
				foundType = parentTypeFromAncestors(schema, ancestors).name
			}
		},
	})

	expect(foundType).toEqual('User')
})
