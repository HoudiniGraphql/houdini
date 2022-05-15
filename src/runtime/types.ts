import { Readable } from 'svelte/store'
import type { ConfigFile } from './config'
import { HoudiniDocumentProxy } from './proxy'
import type { LoadInput } from '@sveltejs/kit'
import { MutationConfig } from './mutation'

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
	config: ConfigFile
	paginationArtifact?: QueryArtifact
	proxy: HoudiniDocumentProxy
}
export type QueryResult<DataType> = {
	isFetching: boolean
	partial: boolean
	source?: DataSource | null
	data?: DataType | null
	error: Error | null
}

export type StoreParams<_Input> = {
	variables?: _Input
	policy?: CachePolicy
}

export type QueryStore<_Data, _Input> = Readable<QueryResult<_Data>> & {
	/**
	 * Trigger the query form load function
	 */
	load: (loadInput: LoadInput, params?: StoreParams<_Input>) => Promise<QueryResult<_Data>>

	/**
	 * Trigger the query form client side (a component for example)
	 */
	query: (params?: StoreParams<_Input>) => Promise<QueryResult<_Data>>
}

// the result of tagging an operation
export type TaggedGraphqlMutation = {
	kind: 'HoudiniMutation'
	store: MutationStore<any, any>
}

export type MutationStore<_Result, _Input> = Readable<{
	data?: _Result | null
	error: Error | null
}> & {
	mutate: <_Result, _Input>(
		i: _Input,
		mutationConfig?: MutationConfig<_Result, _Input>
	) => Promise<_Result>
}

// the result of tagging an operation
export type TaggedGraphqlSubscription = {
	kind: 'HoudiniSubscription'
	artifact: SubscriptionArtifact
	config: ConfigFile
}

// the result of tagging an operation
export type TaggedGraphqlQuery = {
	kind: 'HoudiniQuery'
	component: boolean
	store: QueryStore<any, any>
	config: ConfigFile
	variableFunction: ((...args: any[]) => any) | null
	artifact: QueryArtifact
	getProps: () => any
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
				value: string | number | boolean
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
