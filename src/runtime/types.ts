import type { Config } from '../common'
import { HoudiniDocumentProxy } from './proxy'

export enum CachePolicy {
	CacheOrNetwork = 'CacheOrNetwork',
	CacheOnly = 'CacheOnly',
	NetworkOnly = 'NetworkOnly',
	CacheAndNetwork = 'CacheAndNetwork',
}

export type Fragment<_Result> = {
	readonly shape?: _Result
}

export type Operation<_Result, _Input> = {
	readonly result: _Result
	readonly input: _Input
}

export type Session = any

export type Maybe<T> = T | null | undefined

// any compiled result
export type DocumentArtifact =
	| FragmentArtifact
	| QueryArtifact
	| MutationArtifact
	| SubscriptionArtifact

export enum ArtifactKind {
	Query = 'HoudiniQuery',
	Subcription = 'HoudiniSubscription',
	Mutation = 'HoudiniMutation',
	Fragment = 'HoudiniFragment',
}

export type QueryArtifact = BaseCompiledDocument & {
	kind: ArtifactKind.Query
	policy?: CachePolicy
	partial?: boolean
}

export type MutationArtifact = BaseCompiledDocument & {
	kind: ArtifactKind.Mutation
}

export type FragmentArtifact = BaseCompiledDocument & {
	kind: ArtifactKind.Fragment
}

export type SubscriptionArtifact = BaseCompiledDocument & {
	kind: ArtifactKind.Subcription
}

export enum RefetchUpdateMode {
	append = 'append',
	prepend = 'prepend',
	replace = 'replace',
}

export type InputObject = {
	fields: Record<string, string>
	types: Record<string, Record<string, string>>
}

export type BaseCompiledDocument = {
	name: string
	raw: string
	hash: string
	selection: SubscriptionSelection
	rootType: string
	input?: InputObject
	refetch?: {
		update: RefetchUpdateMode
		path: string[]
		method: 'cursor' | 'offset'
		pageSize: number
		start?: string | number
		embedded: boolean
		targetType: string
	}
}

// the result of the template tag
export type GraphQLTagResult =
	| TaggedGraphqlQuery
	| TaggedGraphqlFragment
	| TaggedGraphqlMutation
	| TaggedGraphqlSubscription

export type TaggedGraphqlFragment = {
	kind: 'HoudiniFragment'
	artifact: FragmentArtifact
	config: Config
	paginationArtifact?: QueryArtifact
	proxy: HoudiniDocumentProxy
}

// the result of tagging an operation
export type TaggedGraphqlMutation = {
	kind: 'HoudiniMutation'
	artifact: MutationArtifact
	config: Config
}

// the result of tagging an operation
export type TaggedGraphqlSubscription = {
	kind: 'HoudiniSubscription'
	artifact: SubscriptionArtifact
	config: Config
}

// the result of tagging an operation
export type TaggedGraphqlQuery = {
	kind: 'HoudiniQuery'
	initialValue: any
	variables: { [key: string]: any }
	artifact: QueryArtifact
	config: Config
	source: DataSource
	partial: boolean
}

type Filter = { [key: string]: string | boolean | number }

export type ListWhen = {
	must?: Filter
	must_not?: Filter
}

export enum DataSource {
	Cache = 'cache',
	Network = 'network',
}

export type MutationOperation = {
	action: 'insert' | 'remove' | 'delete' | 'toggle'
	list?: string
	type?: string
	parentID?: {
		kind: string
		value: string
	}
	position?: 'first' | 'last'
	when?: ListWhen
}

export const CompiledFragmentKind = 'HoudiniFragment'
export const CompiledMutationKind = 'HoudiniMutation'
export const CompiledQueryKind = 'HoudiniQuery'
export const CompiledSubscriptionKind = 'HoudiniSubscription'

export type CompiledDocumentKind =
	| 'HoudiniFragment'
	| 'HoudiniMutation'
	| 'HoudiniQuery'
	| 'HoudiniSubscription'

export type GraphQLObject = { [key: string]: GraphQLValue }

export type GraphQLValue =
	| number
	| string
	| boolean
	| null
	| GraphQLObject
	| GraphQLValue[]
	| undefined

export type SubscriptionSelection = {
	[field: string]: {
		type: string
		nullable?: boolean
		keyRaw: string
		operations?: MutationOperation[]
		list?: {
			name: string
			connection: boolean
			type: string
		}
		update?: RefetchUpdateMode
		filters?: {
			[key: string]: {
				kind: 'Boolean' | 'String' | 'Float' | 'Int' | 'Variable'
				value: string
			}
		}
		fields?: SubscriptionSelection
		abstract?: boolean
	}
}

export type SubscriptionSpec = {
	rootType: string
	selection: SubscriptionSelection
	set: (data: any) => void
	parentID?: string
	variables?: () => any
}
