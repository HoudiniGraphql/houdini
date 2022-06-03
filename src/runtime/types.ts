import { Readable } from 'svelte/store'
import type { ConfigFile } from './config'
import { HoudiniDocumentProxy } from './proxy'
import type { LoadEvent, Page } from '@sveltejs/kit'
import { MutationConfig } from './mutation'

export type { ConfigFile } from './config'

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
		paginated: boolean
		direction?: 'forward' | 'backwards'
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
	store: FragmentStore<any>
	proxy: HoudiniDocumentProxy
}
export type QueryResult<DataType> = {
	isFetching: boolean
	partial: boolean
	source?: DataSource | null
	data?: DataType | null
	errors: Error | null
	variables: {}
}

export type MutationResult<DataType> = {
	isFetching: boolean
	data?: DataType | null
	errors: Error | null
	variables: {}
}

export type QueryStoreParams<_Input> = {
	variables?: _Input
	policy?: CachePolicy

	/**
	 * You know what you are doing and you want a REAL await (even on a client side navigation in load function)
	 */
	blocking?: boolean
} & (
	| {
			/**
			 * Directly the `even` param coming from the `load` function
			 */
			event: LoadEvent

			/**
			 * Only when you are in a component, not here.
			 */
			context?: never
	  }
	| {
			/**
			 * Only in a <script context="module"> `load` function, not here.
			 */
			event?: never
			/**
			 * The HoudiniContext object to get from getHoudiniContext.
			 * Something like this: `const context = getHoudiniContext()`
			 */
			context?: HoudiniContext
	  }
)

export type HoudiniContext = {
	page: Page<Record<string, string>>
	session: Readable<any>
	variables: () => {}
}

export type LoadContext = {
	page: any
	session: Readable<any>
	variables: () => {}
}

export type SubscriptionStore<_Shape, _Input> = Readable<_Shape> & {
	subscribe: (input: _Input) => void
	unsubscribe: () => void
}

export type FragmentStore<_Shape> = {
	load: (
		value: any
	) => Readable<_Shape> & {
		update: (parent: _Shape) => void
	}
}

export type QueryStore<_Data, _Input> = Readable<QueryResult<_Data>> & {
	/**
	 * Trigger the query form load function
	 */
	fetch: (params?: QueryStoreParams<_Input>) => Promise<QueryResult<_Data>>

	/**
	 * Set the partial status for the query (DO NOT USE)
	 */
	setPartial: (val: boolean) => void
}

// the result of tagging an operation
export type TaggedGraphqlMutation = {
	kind: 'HoudiniMutation'
	store: MutationStore<any, any>
}

export type MutationStore<_Result, _Input> = Readable<MutationResult<_Result>> & {
	mutate: (
		params: { variables: _Input; context?: HoudiniContext } & MutationConfig<_Result, _Input>
	) => Promise<MutationResult<_Result>>
}

// the result of tagging an operation
export type TaggedGraphqlSubscription = {
	kind: 'HoudiniSubscription'
	store: SubscriptionStore<any, any>
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
