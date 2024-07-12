import { typeDefs, resolvers } from 'e2e-api/graphql.mjs'
import { createSchema } from 'graphql-yoga'

export default createSchema({
	typeDefs,
	resolvers,
})
