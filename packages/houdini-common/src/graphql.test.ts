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

test('interfaces on interfaces', function () {
	const doc = graphql.parse(`
        query Friends {
            me { 
                goals { 
                    family { 
                        objective { 
                            id
                        }
                    }
                }
            }
        }
    `)

	const schema = graphql.buildSchema(`
        interface Goal {
            id: Int
            title: String
            type: String
        }

        type GoalFamily {
            objective: Objective
        }

        type Objective implements Goal & OkrGoal {
            cachedPercentageComplete: Float
            family: GoalFamily
            id: Int
            title: String
            type: String
        }

        interface OkrGoal implements Goal {
            cachedPercentageComplete: Float
            family: GoalFamily
            id: Int
            title: String
            type: String
        }

        type Query {
            me: User
        }

        type User {
            avatarURL: String
            fullName: String
            goals: [OkrGoal]
            id: Int
            position: String
        }
    `)
	let foundType = ''

	graphql.visit(doc, {
		Field(node, key, parent, path, ancestors) {
			if (node.name.value === 'objective') {
				foundType = parentTypeFromAncestors(schema, ancestors).name
			}
		},
	})

	expect(foundType).toEqual('GoalFamily')
})

test('union ancestor', function () {
	const doc = graphql.parse(`
        query Friends {
            me { 
                goals { 
                    family { 
                        objective { 
                            id
                        }
                    }
                }
            }
        }
    `)

	const schema = graphql.buildSchema(`
        union ObjectiveWithFamily = Objective | GoalFamily

        interface Goal {
            id: Int
            title: String
            type: String
        }

        type Objective implements Goal & OkrGoal {
            family: GoalFamily
        }

        interface OkrGoal implements Goal {
            family: GoalFamily
        }

        type Query {
            me: User
        }

        type User {
            avatarURL: String
            fullName: String
            goals: [GoalFamily]
            id: Int
            position: String
        }
    `)
	let foundType = ''

	expect(graphql.validate(schema, doc)).toHaveLength(0)

	graphql.visit(doc, {
		Field(node, key, parent, path, ancestors) {
			if (node.name.value === 'objective') {
				foundType = parentTypeFromAncestors(schema, ancestors).name
			}
		},
	})

	expect(foundType).toEqual('GoalFamily')
})
