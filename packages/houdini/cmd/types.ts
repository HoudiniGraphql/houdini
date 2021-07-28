import type * as graphql from 'graphql'

export type { ConfigFile } from 'houdini-common'

export * from '../runtime/types'
import { BaseCompiledDocument } from '../runtime/types'

// the result of collecting documents from source code
export type CollectedGraphQLDocument = {
	filename: string
	name: string
	document: graphql.DocumentNode
	originalDocument: graphql.DocumentNode
	generate: boolean
	refetch?: BaseCompiledDocument['refetch']
}

// an error pertaining to a specific graphql document
export type HoudiniDocumentError = graphql.GraphQLError & { filepath: string }

export const HoudiniErrorTodo = Error

// a generic error with an optional description array meant to be printed separately
export type HoudiniInfoError = { message: string; description?: string[] }

// any error that the compiler could fire
export type HoudiniError = HoudiniDocumentError | HoudiniInfoError
