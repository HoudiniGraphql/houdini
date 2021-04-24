import type * as graphql from 'graphql'
export * from './generators/runtime/template/types'

// the result of collecting documents from source code
export type CollectedGraphQLDocument = {
	filename: string
	name: string
	document: graphql.DocumentNode
	originalDocument: graphql.DocumentNode
	printed: string
}
