import { createSchema } from 'graphql-yoga'

export default createSchema({
	typeDefs: /* GraphQL */ `
		type Query {
			hello: String!
			books: [Book!]!
			book(id: ID!): Book
		}

		type Book {
			id: ID!
			title: String!
			author: String!
		}
	`,
	resolvers: {
		Query: {
			hello: () => 'world',
			books: () => [
				{ id: '1', title: 'The Great Gatsby', author: 'F. Scott Fitzgerald' },
				{ id: '2', title: 'To Kill a Mockingbird', author: 'Harper Lee' },
				{ id: '3', title: '1984', author: 'George Orwell' },
			],
			book: (_, { id }) => {
				const books = [
					{ id: '1', title: 'The Great Gatsby', author: 'F. Scott Fitzgerald' },
					{ id: '2', title: 'To Kill a Mockingbird', author: 'Harper Lee' },
					{ id: '3', title: '1984', author: 'George Orwell' },
				]
				return books.find((b) => b.id === id) ?? null
			},
		},
	},
})
