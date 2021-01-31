import graphql from 'graphql'

// the compiled version of an operation
type BaseCompiledDocument = {
	name: string
	raw: string
}

// the information that the compiler leaves behind after processing an operation
export type CompiledGraphqlOperation = BaseCompiledDocument & {
	kind: import('graphql/language').OperationDefinitionNode['kind']
}

// the information that the compiler leaves behind after processing a fragment
export type CompiledGraphqlFragment = BaseCompiledDocument & {
	kind: import('graphql/language').FragmentDefinitionNode['kind']
}

// any compiled result
export type CompiledDocument = CompiledGraphqlFragment | CompiledGraphqlOperation

export type HoudiniCompilerConfig = {
	artifactDirectory: string
}

// the result of collecting documents from source code
export type CollectedGraphQLDocument = {
	name: string
	definition: graphql.FragmentDefinitionNode | graphql.OperationDefinitionNode
}

// transforms are functions that takes the collected documents. some will mutate
// the document definition, some check the definition for errors (undefined fields, etc)
export type Transform = (documents: CollectedGraphQLDocument[]) => Promise<void>
