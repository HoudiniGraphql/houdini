import * as graphql from 'graphql'
import { test, expect } from 'vitest'

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
				foundType = parentTypeFromAncestors(schema, '', ancestors).name
			}
		},
	})

	expect(foundType).toEqual('User')
})

test('inline fragments', function () {
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
				foundType = parentTypeFromAncestors(schema, '', ancestors).name
			}
		},
	})

	expect(foundType).toEqual('User')
})

test('nested inline fragments', function () {
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
                    ... on Node { 
                        id
                    }
                }
            }
        }
    `)

	// we should
	let foundType = ''

	graphql.visit(doc, {
		Field(node, key, parent, path, ancestors) {
			if (node.name.value === 'id') {
				foundType = parentTypeFromAncestors(schema, '', ancestors).name
			}
		},
	})

	expect(foundType).toEqual('Node')
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
                id
            }
        }
    `)

	// we should
	let foundType = ''

	graphql.visit(doc, {
		Field(node, key, parent, path, ancestors) {
			if (node.name.value === 'id') {
				foundType = parentTypeFromAncestors(schema, '', ancestors).name
			}
		},
	})

	expect(foundType).toEqual('Node')
})

test('union ancestor', function () {
	const schema = graphql.buildSchema(`
        union UnionType = TypeB | TypeA

        type TypeA {
            id: String
            objective: TypeB
        }

        type TypeB  {
            family: TypeA
            objective: TypeB
            id: String
        }


        type Query {
            types: [UnionType]
        }
    `)

	const doc = graphql.parse(`
        query Friends {
            types { 
                ... on TypeA {
                    objective { 
                        id
                    }
                }
            }
        }
    `)

	let foundType = ''

	// make sure its valid first
	expect(graphql.validate(schema, doc)).toHaveLength(0)

	graphql.visit(doc, {
		Field(node, key, parent, path, ancestors) {
			if (node.name.value === 'id') {
				foundType = parentTypeFromAncestors(schema, '', ancestors).name
			}
		},
	})

	expect(foundType).toEqual('TypeB')
})
