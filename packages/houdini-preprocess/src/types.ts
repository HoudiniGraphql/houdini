import graphql from 'graphql'
import { Script } from 'svelte/types/compiler/interfaces'

export type Maybe<T> = T | undefined

export type TaggedGraphqlFragment = {
	name: string
	kind: 'FragmentDefinition'
	applyMask: (root: any) => any
}

// the result of tagging an operation
export type TaggedGraphqlMutation = {
	name: string
	kind: 'OperationDefinition'
	raw: string
	processResult: (result: any) => any
}

// the result of tagging an operation
export type TaggedGraphqlQuery = {
	name: string
	kind: 'OperationDefinition'
	raw: string
	processResult: (result: any) => any
}

// the result of the template tag
export type GraphQLTagResult = TaggedGraphqlQuery | TaggedGraphqlFragment | TaggedGraphqlMutation

export type PreProcessorConfig = {
	artifactDirectory: string
	artifactDirectoryAlias: string
	schema: graphql.GraphQLSchema
}

export type TransformDocument = {
	instance: Maybe<Script>
	module: Maybe<Script>
	config: PreProcessorConfig
	dependencies: string[]
}
