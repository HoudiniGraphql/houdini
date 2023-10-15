import { makeExecutableSchema } from '@graphql-tools/schema'

import { resolvers } from './resolvers'
import { typeDefs } from './typeDefs'

export default makeExecutableSchema({ typeDefs, resolvers })
