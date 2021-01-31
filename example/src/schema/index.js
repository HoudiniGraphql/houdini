import { makeExecutableSchema } from '@graphql-tools/schema'
import gql from 'graphql-tag'
import { find, filter } from 'lodash'

const typeDefs = gql`
	type TodoItem {
		id: ID!
		text: String!
		completed: Boolean!
	}

	type Query {
		items: [TodoItem!]!
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
	TodoItem: {
		completed: ({ completed }) => Boolean(completed),
	},
}

export default makeExecutableSchema({
	typeDefs,
	resolvers,
})
