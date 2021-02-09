import graphql from 'graphql'

// the compiled version of an operation
type BaseCompiledDocument = {
	name: string
	raw: string
}

export const CompiledFragmentKind = 'HoudiniFragment'
export const CompiledMutationKind = 'HoudiniMutation'
export const CompiledQueryKind = 'HoudiniQuery'

// the information that the compiler leaves behind after processing an operation
export type CompiledGraphqlQuery = BaseCompiledDocument & {
	kind: 'HoudiniQuery'
}

export type CompiledGraphqlMutation = BaseCompiledDocument & {
	kind: 'HoudiniMutation'
}

// the information that the compiler leaves behind after processing a fragment
export type CompiledGraphqlFragment = BaseCompiledDocument & {
	kind: 'HoudiniFragment'
}

// a description of an interaction between a mutation and a query
export type Patch = {
	fields: { [fieldName: string]: Array<string[]> }
	edges: { [path: string]: Patch }
}

// any compiled result
export type CompiledDocument = CompiledGraphqlFragment | CompiledGraphqlQuery

// the result of collecting documents from source code
export type CollectedGraphQLDocument = {
	name: string
	document: graphql.DocumentNode
}
