// externals
import * as graphql from 'graphql'
// locals
import { Config } from './config'

export type HoudiniError = graphql.GraphQLError & { filepath: string }
