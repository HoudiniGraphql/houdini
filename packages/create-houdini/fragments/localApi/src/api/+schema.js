import { createSchema } from 'graphql-yoga'

export default createSchema({
	typeDefs: /* GraphQL */ `
		type Query {
			hello: String
		}
	`,
	resolvers: {
		Query: {
			hello: () => 'world',
		},
	},
})
