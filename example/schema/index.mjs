import { GraphQLScalarType, Kind } from 'graphql'
import gql from 'graphql-tag'
import { createPubSub, pipe, filter } from 'graphql-yoga'

const pubSub = createPubSub()

export const typeDefs = gql`
	scalar DateTime

	type Error {
		message: String!
		code: String!
	}

	type TodoItem {
		id: ID!
		text: String!
		completed: Boolean!
		createdAt: DateTime!
	}

	type Query {
		items(first: Int, after: String, completed: Boolean): TodoItemConnection!
	}

	type Mutation {
		checkItem(item: ID!): UpdateItemOutput!
		uncheckItem(item: ID!): UpdateItemOutput!
		addItem(input: AddItemInput!): AddItemOutput!
		deleteItem(item: ID!): DeleteIemOutput!
	}

	type Subscription {
		itemUpdate(id: ID!): ItemUpdate!
		newItem: ItemUpdate!
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

	type PageInfo {
		startCursor: String
		endCursor: String
		hasNextPage: Boolean!
		hasPreviousPage: Boolean!
	}

	type TodoItemConnection {
		totalCount: Int!
		pageInfo: PageInfo!
		edges: [TodoItemEdge!]!
	}

	type TodoItemEdge {
		cursor: String
		node: TodoItem
	}
`

// example data
let items = [
	{ id: '1', text: 'Taste JavaScript', createdAt: new Date() },
	{ id: '2', text: 'Buy a unicorn', createdAt: new Date() },
	{ id: '3', text: 'Taste more JavaScript', createdAt: new Date() },
	{ id: '4', text: 'Buy a another unicorn', createdAt: new Date() },
	{ id: '5', text: 'Taste even more JavaScript', createdAt: new Date() },
	{ id: '6', text: 'Buy a third unicorn', createdAt: new Date() },
]

let id = items.length

export const resolvers = {
	Query: {
		items: (_, { completed, after, first } = {}) => {
			// apply the filter
			const filtered = items.filter((item) =>
				typeof completed === 'boolean'
					? Boolean(item.completed) === Boolean(completed)
					: true
			)

			let targetItems = [...filtered]

			// if we have an after to apply, do it
			let skipped = 0
			let head = null
			if (after) {
				while (targetItems.length > 0 && (!head || head.id !== after)) {
					head = targetItems.shift()
					skipped++
				}
			}

			// if we have a first to apply
			if (typeof first !== 'undefined') {
				targetItems = targetItems.slice(0, first)
			}

			const connection = {
				totalCount: filtered.length,
				pageInfo: {
					startCursor: targetItems[0]?.id,
					endCursor: targetItems[targetItems.length - 1]?.id,
					hasNextPage: targetItems.length + skipped < filtered.length,
					hasPreviousPage: skipped > 0,
				},
				edges: targetItems.map((item) => ({
					cursor: item.id,
					node: item,
				})),
			}

			return connection
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

			// notify any subscribers
			pubSub.publish('ITEM_UPDATE', { item })

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

			// notify any subscribers
			pubSub.publish('ITEM_UPDATE', { item })

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
			const item = {
				text,
				completed: false,
				id: (parseInt(id, 10) + 1).toString(),
				createdAt: new Date(),
			}
			id++

			// add the item to the end of the list even though the UI adds it to the top
			// in order to simulate filling in an item in a connection that was
			// added as part of a mutation operation but later found in the same list
			// while paginating
			items.push(item)

			// notify any subscribers
			pubSub.publish('NEW_ITEM', { item })

			return { item, error: null }
		},
	},
	TodoItem: {
		completed: ({ completed }) => Boolean(completed),
	},
	Subscription: {
		itemUpdate: {
			subscribe: (_, args) => {
				return pipe(
					pubSub.subscribe('ITEM_UPDATE'),
					filter((payload) => {
						return payload.item.id === args.id
					})
				)
			},
			resolve: (payload) => payload,
		},
		newItem: {
			subscribe: () => pubSub.subscribe('NEW_ITEM'),
			resolve: (payload) => {
				return payload
			},
		},
	},
	DateTime: new GraphQLScalarType({
		name: 'DateTime',
		description: 'Date custom scalar type',
		serialize(value) {
			return value.getTime()
		},
		parseValue(value) {
			return new Date(value)
		},
		parseLiteral(ast) {
			if (ast.kind === Kind.INT) {
				return new Date(parseInt(ast.value, 10))
			}
			return null
		},
	}),
}
