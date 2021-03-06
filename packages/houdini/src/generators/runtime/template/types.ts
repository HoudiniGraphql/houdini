export { TypeLinks, SubscriptionSelection } from './cache'
import { TypeLinks, SubscriptionSelection } from './cache'

export type Fragment<_Result> = {
	readonly shape?: _Result
}

export type Operation<_Result, _Input> = {
	readonly result: _Result
	readonly input: _Input
}

export type Session = any

export type Maybe<T> = T | null

export type TaggedGraphqlFragment = {
	kind: 'HoudiniFragment'
	artifact: FragmentArtifact
}

// the result of tagging an operation
export type TaggedGraphqlMutation = {
	kind: 'HoudiniMutation'
	artifact: MutationArtifact
}

// the result of tagging an operation
export type TaggedGraphqlQuery = {
	kind: 'HoudiniQuery'
	initialValue: any
	variables: { [key: string]: any }
	artifact: QueryArtifact
}

// the result of the template tag
export type GraphQLTagResult = TaggedGraphqlQuery | TaggedGraphqlFragment | TaggedGraphqlMutation

type Filter = { [key: string]: string | boolean | number }

export type ConnectionWhen = {
	must?: Filter
	must_not?: Filter
}

export type MutationOperation = {
	source: string[]
	kind: 'insert' | 'remove' | 'delete'
	target: string
	parentID?: {
		kind: string
		value: string
	}
	position?: 'first' | 'last'
	when?: ConnectionWhen
}

// the compiled version of an operation
type BaseCompiledDocument = {
	name: string
	raw: string
	hash: string
	selection: SubscriptionSelection
	rootType: string
}

// the information that the compiler leaves behind after processing an operation
export type QueryArtifact = BaseCompiledDocument & {
	kind: 'HoudiniQuery'
	response: TypeLinks
}

export type MutationArtifact = BaseCompiledDocument & {
	kind: 'HoudiniMutation'
	response: TypeLinks
	operations: MutationOperation[]
}

// the information that the compiler leaves behind after processing a fragment
export type FragmentArtifact = BaseCompiledDocument & {
	kind: 'HoudiniFragment'
}

// any compiled result
export type DocumentArtifact = FragmentArtifact | QueryArtifact | MutationArtifact

export const CompiledFragmentKind = 'HoudiniFragment'
export const CompiledMutationKind = 'HoudiniMutation'
export const CompiledQueryKind = 'HoudiniQuery'

export type CompiledDocumentKind = 'HoudiniFragment' | 'HoudiniMutation' | 'HoudiniQuery'
