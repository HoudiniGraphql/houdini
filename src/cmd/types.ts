import type * as graphql from 'graphql'

export type { ConfigFile } from '../runtime/lib'
export * from '../runtime/lib/types'
import { BaseCompiledDocument, ArtifactKind } from '../runtime/lib/types'

// the result of collecting documents from source code
export type CollectedGraphQLDocument = {
	kind: ArtifactKind
	filename: string
	name: string
	document: graphql.DocumentNode
	originalDocument: graphql.DocumentNode
	generateArtifact: boolean
	generateStore: boolean
	originalString: string
	refetch?: BaseCompiledDocument['refetch']
}

// an error pertaining to a specific graphql document
export type HoudiniDocumentError = graphql.GraphQLError & { filepath: string }

export const HoudiniErrorTodo = Error

// a generic error with an optional description array meant to be printed separately
export type HoudiniInfoError = { message: string; description?: string[] }

// any error that the compiler could fire
export type HoudiniError = HoudiniDocumentError | HoudiniInfoError | Error
