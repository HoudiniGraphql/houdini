import * as graphql from 'graphql'
import { getTypeFromAncestors } from './graphql'

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
				foundType = getTypeFromAncestors(schema, ancestors).name
			}
		},
	})

	expect(foundType).toEqual('User')
})
