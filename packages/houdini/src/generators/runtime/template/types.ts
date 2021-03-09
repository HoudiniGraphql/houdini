export type Fragment<_Result> = {
	readonly shape?: _Result
}

export type Operation<_Result, _Input> = {
	readonly result: _Result
	readonly input: _Input
}

export type Session = any

export type Maybe<T> = T | null

// any compiled result
export type DocumentArtifact = FragmentArtifact | QueryArtifact | MutationArtifact

export type QueryArtifact = BaseCompiledDocument & {
	kind: 'HoudiniQuery'
	response: SubscriptionSelection
}

export type MutationArtifact = BaseCompiledDocument & {
	kind: 'HoudiniMutation'
	response: SubscriptionSelection
}

export type FragmentArtifact = BaseCompiledDocument & {
	kind: 'HoudiniFragment'
}

type BaseCompiledDocument = {
	name: string
	raw: string
	hash: string
	selection: SubscriptionSelection
	rootType: string
}

// the result of the template tag
export type GraphQLTagResult = TaggedGraphqlQuery | TaggedGraphqlFragment | TaggedGraphqlMutation

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

type Filter = { [key: string]: string | boolean | number }

export type ConnectionWhen = {
	must?: Filter
	must_not?: Filter
}

export type MutationOperation = {
	action: 'insert' | 'remove' | 'delete'
	connection?: string
	type?: string
	parentID?: {
		kind: string
		value: string
	}
	position?: 'first' | 'last'
	when?: ConnectionWhen
}

export const CompiledFragmentKind = 'HoudiniFragment'
export const CompiledMutationKind = 'HoudiniMutation'
export const CompiledQueryKind = 'HoudiniQuery'

export type CompiledDocumentKind = 'HoudiniFragment' | 'HoudiniMutation' | 'HoudiniQuery'

export type GraphQLValue =
	| number
	| string
	| boolean
	| null
	| { [key: string]: GraphQLValue }
	| GraphQLValue[]

export type SubscriptionSelection = {
	[field: string]: {
		type: string
		keyRaw: string
		operations?: MutationOperation[]
		connection?: string
		filters?: {
			[key: string]: {
				kind: 'Boolean' | 'String' | 'Float' | 'Int' | 'Variable'
				value: string
			}
		}
		fields?: SubscriptionSelection
	}
}

export type SubscriptionSpec = {
	rootType: string
	selection: SubscriptionSelection
	set: (data: any) => void
	parentID?: string
}
