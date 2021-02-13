// externals
import * as graphql from 'graphql'

// an error pertaining to a specific graphql document
export type HoudiniDocumentError = graphql.GraphQLError & { filepath: string }

export const HoudiniErrorTodo = Error

// a generic error with an optional description array meant to be printed separately
export type HoudiniInfoError = { message: string; description?: string[] }

// any error that the compiler could fire
export type HoudiniError = HoudiniDocumentError | HoudiniInfoError
