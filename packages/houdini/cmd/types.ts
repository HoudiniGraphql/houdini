import type * as graphql from 'graphql'
export * from '../runtime/types'

// the result of collecting documents from source code
export type CollectedGraphQLDocument = {
	filename: string
	name: string
	document: graphql.DocumentNode
	originalDocument: graphql.DocumentNode
	generate: boolean
	refetch?: {
		update: RefetchUpdateMode
		source: string[]
		target: string[]
		method: 'cursor' | 'offset'
	}
}

export enum RefetchUpdateMode {
	append = 'append',
	prepend = 'prepend',
	replace = 'replace',
}

// an error pertaining to a specific graphql document
export type HoudiniDocumentError = graphql.GraphQLError & { filepath: string }

export const HoudiniErrorTodo = Error

// a generic error with an optional description array meant to be printed separately
export type HoudiniInfoError = { message: string; description?: string[] }

// any error that the compiler could fire
export type HoudiniError = HoudiniDocumentError | HoudiniInfoError
