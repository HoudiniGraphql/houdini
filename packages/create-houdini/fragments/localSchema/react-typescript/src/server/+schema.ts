import { createSchema } from 'graphql-yoga'

export default createSchema({
	typeDefs: /* GraphQL */ `
		type Query {
			message: String
		}
	`,
	resolvers: {
		Query: {
			message: () => 'Greetings from your local api 👋',
		},
	},
})
