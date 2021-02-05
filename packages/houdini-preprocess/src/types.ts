import graphql from 'graphql'
import { Script } from 'svelte/types/compiler/interfaces'

export type Maybe<T> = T | undefined

export const TaggedFragmentKind = 'HoudiniFragment'
export type TaggedGraphqlFragment = {
	name: string
	kind: 'HoudiniFragment'
	applyMask: (root: any) => any
}

// the result of tagging an operation
export const TaggedMutationKind = 'HoudiniMutation'
export type TaggedGraphqlMutation = {
	name: string
	kind: 'HoudiniMutation'
	raw: string
	processResult: (result: any) => any
}

// the result of tagging an operation
export const TaggedQueryKind = 'HoudiniQuery'
export type TaggedGraphqlQuery = {
	name: string
	kind: 'HoudiniQuery'
	raw: string
	processResult: (result: any) => any
	initialValue: any
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
	filename: string
}
