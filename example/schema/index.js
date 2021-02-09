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
		items(completed: Boolean): [TodoItem!]!
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
	{ id: '1', text: 'Taste JavaScript' },
	{ id: '2', text: 'Buy a unicorn' },
]

const resolvers = {
	Query: {
		items: (_, { completed } = {}) => {
			// if completed is undefined there is no filter
			if (typeof completed === 'undefined') {
				return items
			}

			return items.filter((item) => Boolean(item.completed) === Boolean(completed))
		},
	},
	Mutation: {
		completeItem(_, { id: targetID }) {
			// grab the item in question
			const item = items.find(({ id }) => id === targetID)
			if (!item) {
				throw new Error('Could not find item')
			}

			// update the completed value
			item.completed = true

			return {
				error: null,
				item,
			}
		},
		uncompleteItem(_, { id: targetID }) {
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
