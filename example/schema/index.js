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
		checkItem(item: ID!): UpdateItemOutput!
		uncheckItem(item: ID!): UpdateItemOutput!
		addItem(input: AddItemInput!): AddItemOutput!
		deleteItem(item: ID!): DeleteIemOutput!
	}

	type Subscription {
		itemUpdate(id: ID!): ItemUpdate!
	}

	input AddItemInput {
		text: String!
	}

	type AddItemOutput {
		error: Error
		item: TodoItem
	}

	type UpdateItemOutput {
		error: Error
		item: TodoItem
	}

	type DeleteIemOutput {
		error: Error
		itemID: ID
	}

	type ItemUpdate {
		item: TodoItem!
	}
`

id = 3

// example data
let items = [
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
		checkItem(_, { item: targetID, ...rest }) {
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
		uncheckItem(_, { item: targetID }) {
			// grab the item in question
			const item = items.find(({ id }) => id === targetID)

			// update the completed value
			item.completed = false

			return {
				error: null,
				item,
			}
		},
		deleteItem(_, { item: targetID }) {
			// filter out the item with the matching id
			items = items.filter(({ id }) => id !== targetID)

			return {
				error: null,
				itemID: targetID,
			}
		},
		addItem(_, { input: { text } }) {
			const item = { text, completed: false, id: (parseInt(id, 10) + 1).toString() }
			id++
			items.unshift(item)
			return { item, error: null }
		},
	},
	TodoItem: {
		completed: ({ completed }) => Boolean(completed),
	},
	Subscription: {
		itemUpdate: (_, { id }) => {
			console.log('open socket')
		},
	},
}

module.exports = makeExecutableSchema({
	typeDefs,
	resolvers,
})
