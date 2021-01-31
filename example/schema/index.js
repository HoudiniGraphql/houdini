const { makeExecutableSchema } = require('@graphql-tools/schema')
const gql = require('graphql-tag')
const { find, filter } = require('lodash')

const typeDefs = gql`
	type Error {
		message: String!
		code: String!
	}

	type TodoItem {
		id: ID!
		text: String!
		completed: Boolean!
	}

	type Query {
		items: [TodoItem!]!
	}

	type Mutation {
		completeItem(id: ID!): UpdateItemOutput!
		uncompleteItem(id: ID!): UpdateItemOutput!
	}

	type UpdateItemOutput {
		error: Error
		item: TodoItem
	}
`

// example data
const items = [
	{ id: 1, text: 'Taste JavaScript' },
	{ id: 2, text: 'Buy a unicorn' },
]

const resolvers = {
	Query: {
		items: () => items,
	},
	Mutation: {
		completeItem({ id: targetID }) {
			// grab the item in question
			const item = items.find(({ id }) => id === targetID)

			// update the completed value
			item.completed = true

			return {
				error: null,
				item,
			}
		},
		uncompleteItem({ id: targetID }) {
			// grab the item in question
			const item = items.find(({ id }) => id === targetID)

			// update the completed value
			item.completed = false

			return {
				error: null,
				item,
			}
		},
	},
	TodoItem: {
		completed: ({ completed }) => Boolean(completed),
	},
}

module.exports = makeExecutableSchema({
	typeDefs,
	resolvers,
})
