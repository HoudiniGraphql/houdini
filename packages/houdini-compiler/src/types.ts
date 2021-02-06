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

// any compiled result
export type CompiledDocument = CompiledGraphqlFragment | CompiledGraphqlQuery

export type HoudiniCompilerConfig = {
	artifactDirectory: string
}

// the result of collecting documents from source code
export type CollectedGraphQLDocument = {
	name: string
	document: graphql.DocumentNode
}
// transforms are functions that takes the collected documents. some will mutate
// the document definition, some check the definition for errors (undefined fields, etc)
export type Transform<_TransformType> = (documents: _TransformType) => Promise<void>

// the transforms to apply form a graph
export type TransformPipeline<_TransformType> = {
	transforms: Transform<_TransformType>[]
	then?: TransformPipeline<_TransformType>[]
}
