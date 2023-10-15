type ValuesOf<Target> = Target[keyof Target]

export const CachePolicy = {
	CacheOrNetwork: 'CacheOrNetwork',
	CacheOnly: 'CacheOnly',
	NetworkOnly: 'NetworkOnly',
	CacheAndNetwork: 'CacheAndNetwork',
} as const

export type CachePolicies = ValuesOf<typeof CachePolicy>

export const PaginateMode = {
	Infinite: 'Infinite',
	SinglePage: 'SinglePage',
} as const

export type PaginateModes = ValuesOf<typeof PaginateMode>

export * from '../router/types'

declare global {
	namespace App {
		interface Session {}
		interface Metadata {}
		interface Stuff {
			inputs: {
				init: boolean
				marshaled: Record<string, any>
				changed: boolean
			}
			optimisticResponse?: GraphQLObject
			parentID?: string
			silenceLoading?: boolean
		}
	}
}

export type Fragment<_Result> = {
	readonly shape?: _Result
}

export type Operation<_Result, _Input> = {
	readonly result: _Result
	readonly input: _Input
}

export type Maybe<T> = T | null | undefined

// any compiled result
export type DocumentArtifact =
	| FragmentArtifact
	| QueryArtifact
	| MutationArtifact
	| SubscriptionArtifact

export const ArtifactKind = {
	Query: 'HoudiniQuery',
	Subscription: 'HoudiniSubscription',
	Mutation: 'HoudiniMutation',
	Fragment: 'HoudiniFragment',
} as const

export type ArtifactKinds = ValuesOf<typeof ArtifactKind>

export const CompiledFragmentKind = ArtifactKind.Fragment
export const CompiledMutationKind = ArtifactKind.Mutation
export const CompiledQueryKind = ArtifactKind.Query
export const CompiledSubscriptionKind = ArtifactKind.Subscription

export type CompiledDocumentKind = ArtifactKinds

export type QueryArtifact = BaseCompiledDocument<'HoudiniQuery'> & {
	policy?: CachePolicies
	partial?: boolean
	enableLoadingState?: 'global' | 'local'
}

export type MutationArtifact = BaseCompiledDocument<'HoudiniMutation'>

export type FragmentArtifact = BaseCompiledDocument<'HoudiniFragment'> & {
	enableLoadingState?: 'global' | 'local'
}

export type SubscriptionArtifact = BaseCompiledDocument<'HoudiniSubscription'>

export const RefetchUpdateMode = {
	append: 'append',
	prepend: 'prepend',
	replace: 'replace',
} as const

export type RefetchUpdateModes = ValuesOf<typeof RefetchUpdateMode>

export type InputObject = {
	fields: Record<string, string>
	types: Record<string, Record<string, string>>
}

export type BaseCompiledDocument<_Kind extends ArtifactKinds> = {
	name: string
	kind: _Kind
	raw: string
	hash: string
	selection: SubscriptionSelection
	rootType: string
	input?: InputObject
	hasComponents?: boolean
	refetch?: {
		path: string[]
		method: 'cursor' | 'offset'
		pageSize: number
		start?: string | number
		embedded: boolean
		targetType: string
		paginated: boolean
		direction: 'forward' | 'backward' | 'both'
		mode: PaginateModes
	}
	pluginData: Record<string, any>
}

export type HoudiniFetchContext = {
	variables: () => {}
}

type Filter = { [key: string]: string | boolean | number }

export type ListWhen = {
	must?: Filter
	must_not?: Filter
}

export const DataSource = {
	/**
	 * from the browser cache
	 */
	Cache: 'cache',
	/**
	 * from a browser side `fetch`
	 */
	Network: 'network',
	/**
	 * from a server side `fetch`
	 */
	Ssr: 'ssr',
} as const

export type DataSources = ValuesOf<typeof DataSource>

export type MutationOperation = {
	action: 'insert' | 'remove' | 'delete' | 'toggle'
	list?: string
	type?: string
	parentID?: {
		kind: string
		value: string
	}
	position?: 'first' | 'last'
	target?: 'all'
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

export type GraphQLVariables = { [key: string]: any } | null

export type LoadingSpec =
	| { kind: 'continue'; list?: { depth: number; count: number } }
	| { kind: 'value'; value?: any; list?: { depth: number; count: number } }

export type SubscriptionSelection = {
	loadingTypes?: string[]
	fragments?: Record<string, { arguments: ValueMap; loading?: boolean }>
	components?: Record<string, { prop: string; attribute: string }>
	fields?: {
		[fieldName: string]: {
			type: string
			keyRaw: string
			nullable?: boolean
			// @required directive (bubbles nullability up)
			required?: boolean
			operations?: MutationOperation[]
			list?: {
				name: string
				connection: boolean
				type: string
			}
			loading?: LoadingSpec
			directives?: { name: string; arguments: ValueMap }[]
			updates?: string[]
			visible?: boolean
			filters?: Record<
				string,
				{
					kind: 'Boolean' | 'String' | 'Float' | 'Int' | 'Variable'
					value: string | number | boolean
				}
			>
			selection?: SubscriptionSelection
			abstract?: boolean
			// If set, this is an abstract type with at least one abstract field made non-nullable by
			// @required. This means that it needs to always be non-null even if there is no useful data.
			abstractHasRequired?: boolean
			component?: {
				prop: string
				key: string
				fragment: string
				variables: ValueMap | null
			}
		}
	}
	abstractFields?: {
		fields: {
			[typeName: string]: SubscriptionSelection['fields']
		}
		// a mapping of __typenames to abstract types that might appear in the selection
		typeMap: {
			[typeName: string]: string
		}
	}
}

export type SubscriptionSpec = {
	rootType: string
	selection: SubscriptionSelection
	set: (data: any) => void
	parentID?: string
	variables?: () => any
}

export type FetchQueryResult<_Data> = {
	result: RequestPayload<_Data | null>
	source: DataSources | null
}

export type QueryResult<_Data = GraphQLObject, _Input = GraphQLVariables> = {
	data: _Data | null
	errors: { message: string }[] | null
	fetching: boolean
	partial: boolean
	stale: boolean
	source: DataSources | null
	variables: _Input | null
}

export type RequestPayload<GraphQLObject = any> = {
	data: GraphQLObject | null
	errors:
		| {
				message: string
		  }[]
		| null
}

export type NestedList<_Result = string> = (_Result | null | NestedList<_Result>)[]

export type ValueOf<Parent> = Parent[keyof Parent]

export const fragmentKey = ' $fragments' as const

export type ValueNode =
	| VariableNode
	| IntValueNode
	| FloatValueNode
	| StringValueNode
	| BooleanValueNode
	| NullValueNode
	| EnumValueNode
	| ListValueNode
	| ObjectValueNode

export type ValueMap = Record<string, ValueNode>

export type FetchParams<_Input> = {
	variables?: _Input

	/**
	 * The policy to use when performing the fetch. If set to CachePolicy.NetworkOnly,
	 * a request will always be sent, even if the variables are the same as the last call
	 * to fetch.
	 */
	policy?: CachePolicies

	/**
	 * An object that will be passed to the fetch function.
	 * You can do what you want with it!
	 */
	// @ts-ignore
	metadata?: App.Metadata
}

export type FetchFn<_Data extends GraphQLObject, _Input = any> = (
	params?: FetchParams<_Input>
) => Promise<QueryResult<_Data, _Input>>

export type CursorHandlers<_Data extends GraphQLObject, _Input> = {
	loadNextPage: (args?: {
		first?: number
		after?: string
		fetch?: typeof globalThis.fetch
		metadata?: {}
	}) => Promise<void>
	loadPreviousPage: (args?: {
		last?: number
		before?: string
		fetch?: typeof globalThis.fetch
		metadata?: {}
	}) => Promise<void>
	fetch(args?: FetchParams<_Input> | undefined): Promise<QueryResult<_Data, _Input>>
}

export type OffsetHandlers<_Data extends GraphQLObject, _Input> = {
	loadNextPage: (args?: {
		limit?: number
		offset?: number
		metadata?: {}
		fetch?: typeof globalThis.fetch
	}) => Promise<void>
	fetch(args?: FetchParams<_Input> | undefined): Promise<QueryResult<_Data, _Input>>
}

export type PageInfo = {
	startCursor: string | null
	endCursor: string | null
	hasNextPage: boolean
	hasPreviousPage: boolean
}

interface IntValueNode {
	readonly kind: 'IntValue'
	readonly value: string
}

interface FloatValueNode {
	readonly kind: 'FloatValue'
	readonly value: string
}

interface StringValueNode {
	readonly kind: 'StringValue'
	readonly value: string
}

interface BooleanValueNode {
	readonly kind: 'BooleanValue'
	readonly value: boolean
}

interface NullValueNode {
	readonly kind: 'NullValue'
}

interface EnumValueNode {
	readonly kind: 'EnumValue'
	readonly value: string
}

interface ListValueNode {
	readonly kind: 'ListValue'
	readonly values: ReadonlyArray<ValueNode>
}

interface ObjectValueNode {
	readonly kind: 'ObjectValue'
	readonly fields: ReadonlyArray<ObjectFieldNode>
}

interface ObjectFieldNode {
	readonly kind: 'ObjectField'
	readonly name: NameNode
	readonly value: ValueNode
}

interface NameNode {
	readonly kind: 'Name'
	readonly value: string
}

interface VariableNode {
	readonly kind: 'Variable'
	readonly name: NameNode
}

export const PendingValue = Symbol('houdini_loading')

export type LoadingType = typeof PendingValue

export function isPending(value: any): value is LoadingType {
	return typeof value === 'symbol'
}

// The manifest is a tree of routes that the router will use to render
// the correct component tree for a given url
export type ProjectManifest = {
	/** All of the pages in the project */
	pages: Record<string, PageManifest>
	/** All of the layouts in the project */
	layouts: Record<string, PageManifest>
	/** All of the page queries in the project */
	page_queries: Record<string, QueryManifest>
	/** All of the layout queries in the project */
	layout_queries: Record<string, QueryManifest>
	/** All of the artifacts in the project */
	artifacts: string[]
	/** Whether or not there is a local schema defined */
	local_schema: boolean
	/** Whether or not there is a custom instance of yoga defined */
	local_yoga: boolean
	/** Information about componentFields defined in the project */
	component_fields: Record<string, { filepath: string }>
}

export type PageManifest = {
	id: string
	/** the name of every query that the page depends on */
	queries: string[]
	/** the list of queries that this page could potentially ask for */
	query_options: string[]
	/** the full url pattern of the page */
	url: string
	/** the ids of layouts that wrap this page */
	layouts: string[]
	/** The filepath of the unit */
	path: string
}

export type QueryManifest = {
	/** the name of the query */
	name: string
	/** the url tied with the query */
	url: string
	/** wether the query uses the loading directive (ie, wants a fallback) */
	loading: boolean
	/** The filepath of the unit */
	path: string
}
