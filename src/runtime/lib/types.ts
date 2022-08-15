import type { LoadEvent, RequestEvent } from '@sveltejs/kit'
import { Readable } from 'svelte/store'

import { FetchContext, HoudiniDocumentProxy } from '..'
import { MutationConfig } from '../inline/mutation'

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

export const CompiledFragmentKind = ArtifactKind.Fragment
export const CompiledMutationKind = ArtifactKind.Mutation
export const CompiledQueryKind = ArtifactKind.Query
export const CompiledSubscriptionKind = ArtifactKind.Subcription

export type CompiledDocumentKind = ArtifactKind

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
	| QueryStore<any, any>
	| FragmentStore<any>
	| MutationStore<any, any>
	| SubscriptionStore<any, any>

export type QueryResult<_Data, _Input> = {
	data: _Data | null
	errors: { message: string }[] | null
	isFetching: boolean
	partial: boolean
	source: DataSource | null
	variables: _Input | null
}

export type MutationResult<_Data, _Input> = {
	data: _Data | null
	errors: { message: string }[] | null
	isFetching: boolean
	isOptimisticResponse: boolean
	variables: _Input | null
}

type FetchGlobalParams<_Input> = {
	variables?: _Input

	/**
	 * The policy to use when performing the fetch. If set to CachePolicy.NetworkOnly,
	 * a request will always be sent, even if the variables are the same as the last call
	 * to fetch.
	 */
	policy?: CachePolicy

	/**
	 * An object that will be passed to the fetch function.
	 * You can do what you want with it!
	 */
	// @ts-ignore
	metadata?: App.Metadata

	/**
	 * Set to true if you want the promise to pause while it's resolving.
	 * Only enable this if you know what you are doing. This will cause route
	 * transitions to pause while loading data.
	 */
	blocking?: boolean
}

type LoadEventFetchParams<_Input> = FetchGlobalParams<_Input> & {
	/**
	 * Directly the `even` param coming from the `load` function
	 */
	event?: LoadEvent
}

type RequestEventFetchParams<_Input> = FetchGlobalParams<_Input> & {
	/**
	 * A RequestEvent should be provided when the store is being used in an endpoint.
	 * When this happens, fetch also needs to be provided
	 */
	event?: RequestEvent
	/**
	 * The fetch function to use when using this store in an endpoint.
	 */
	fetch?: LoadEvent['fetch']
}

type ClientFetchParams<_Input> = FetchGlobalParams<_Input> & {
	/**
	 * An object containing all of the current info necessary for a
	 * client-side fetch. Must be called in component initialization with
	 * something like this: `const context = getHoudiniFetchContext()`
	 */
	context?: HoudiniFetchContext
}

export type QueryStoreFetchParams<_Input> = QueryStoreLoadParams<_Input> | ClientFetchParams<_Input>

export type QueryStoreLoadParams<_Input> =
	| LoadEventFetchParams<_Input>
	| RequestEventFetchParams<_Input>

export type HoudiniFetchContext = {
	session: () => App.Session | null
	variables: () => {}
}

export type SubscriptionStore<_Shape, _Input> = Readable<_Shape> & {
	name: string
	kind: typeof CompiledSubscriptionKind
	listen: (input: _Input) => void
	unlisten: () => void
}

export type FragmentStore<_Shape> = {
	name: string
	kind: typeof CompiledFragmentKind
	paginated: boolean
	setContext(ctx: HoudiniFetchContext): void
	get<T extends Fragment<_Shape>>(value: T): Readable<_Shape>
	get<T extends Fragment<_Shape>>(value: T | null): Readable<_Shape | null>
}

export type QueryStore<_Data, _Input, _Extra = {}> = Readable<
	QueryResult<_Data, _Input> & _Extra
> & {
	name: string
	kind: typeof CompiledQueryKind
	variables: boolean
	artifact: QueryArtifact
	setContext(ctx: HoudiniFetchContext): void

	/**
	 * Fetch the data from the server
	 */
	fetch(params?: RequestEventFetchParams<_Input>): Promise<QueryResult<_Data, _Input> & _Extra>
	fetch(params?: LoadEventFetchParams<_Input>): Promise<QueryResult<_Data, _Input> & _Extra>
	fetch(params?: ClientFetchParams<_Input>): Promise<QueryResult<_Data, _Input> & _Extra>
	fetch(params?: QueryStoreFetchParams<_Input>): Promise<QueryResult<_Data, _Input> & _Extra>
}

export type MutationStore<_Result, _Input> = Readable<MutationResult<_Result, _Input>> & {
	name: string
	kind: typeof CompiledMutationKind
	setContext(ctx: HoudiniFetchContext): void
	mutate: (
		params: {
			variables: _Input
			// @ts-ignore
			metadata?: App.Metadata
			context?: HoudiniFetchContext
			fetch?: LoadEvent['fetch']
		} & MutationConfig<_Result, _Input>
	) => Promise<MutationResult<_Result, _Input>>
}

type Filter = { [key: string]: string | boolean | number }

export type ListWhen = {
	must?: Filter
	must_not?: Filter
}

export enum DataSource {
	/**
	 * from the browser cache
	 */
	Cache = 'cache',
	/**
	 * from a browser side `fetch`
	 */
	Network = 'network',
	/**
	 * from a server side `fetch`
	 */
	Ssr = 'ssr',
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

export type VariableFunction<_Params extends Record<string, string>, _Input> = (
	event: LoadEvent<_Params>
) => _Input
