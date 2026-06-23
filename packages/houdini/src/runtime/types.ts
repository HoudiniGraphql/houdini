import type { PaginateModes } from 'houdini'

export type { ConfigFile, PaginateModes } from 'houdini'

type ValuesOf<Target> = Target[keyof Target]

export const DedupeMatchMode = {
	Variables: 'Variables',
	Operation: 'Operation',
	None: 'None',
} as const

export type DedupeMatchModes = ValuesOf<typeof DedupeMatchMode>

export * from '../router/types.js'

declare global {
	namespace App {
		interface Session {}
		interface Metadata {}
		interface GraphQLErrorExtensions {}
		interface Stuff {
			inputs: {
				init: boolean
				marshaled: Record<string, any>
				changed: boolean
			}
			optimisticResponse?: GraphQLObject
			parentID?: string
			silenceLoading?: boolean
			mutationID?: number
		}
	}
}

export type RuntimeScalarResolver = (args: { session: App.Session }) => any

export type Fragment<_Result> = {
	readonly shape?: _Result
	readonly ' $fragments'?: Record<string, unknown>
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
	dedupe?: {
		cancel: 'first' | 'last'
		match: DedupeMatchModes
	}
}

export type MutationArtifact = BaseCompiledDocument<'HoudiniMutation'> & {
	optimisticKeys?: boolean
	dedupe?: {
		cancel: 'first' | 'last'
		match: DedupeMatchModes
	}
}

export type FragmentArtifact = BaseCompiledDocument<'HoudiniFragment'> & {
	enableLoadingState?: 'global' | 'local'
	// @plural marks the fragment as list-shaped: it is spread on a list field and
	// consumed as an array of items rather than a single record.
	plural?: boolean
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
	defaults: Record<string, any>
	runtimeScalars: Record<string, string>
}

// the parsed @endpoint(redirect:) template: literal string segments interleaved with
// interpolation paths (each a dotted field path as a string array), e.g.
// ["/users/", ["createUser", "id"]]. Built by the compiler; interpolated identically by
// the server form handler and the client form hook.
export type RedirectTemplate = ReadonlyArray<string | readonly string[]>

// @endpoint metadata on a mutation artifact: the marker that a mutation is form-submittable
// plus what the runtime/server need to drive the form.
export type EndpointSpec = {
	redirect?: RedirectTemplate
	multipart?: boolean
	id?: string
	// an optional allowlist of form-field names (`@endpoint(fields: […])`). When present,
	// only these submitted keys are accepted; everything else is dropped before the mutation
	// runs — the mitigation for in-schema over-posting / mass assignment. Entries use the
	// same dotted/`[]` vocabulary as form field names ("input.email", "tags[]").
	fields?: readonly string[]
}

export type BaseCompiledDocument<_Kind extends ArtifactKinds> = Readonly<{
	name: string
	kind: _Kind
	raw: string
	hash: string
	selection: SubscriptionSelection
	rootType: string
	input?: InputObject
	endpoint?: EndpointSpec
	// @auth: a dotted path into the mutation result whose object value becomes App.Session.
	// Orthogonal to `endpoint` — present on any session-establishing mutation, form or not.
	sessionPath?: string
	hasComponents?: boolean
	stripVariables: Array<string>
	refetch?: {
		path: readonly string[]
		method: 'cursor' | 'offset'
		pageSize: number
		start?: string | number
		embedded: boolean
		targetType: string
		paginated: boolean
		direction: 'forward' | 'backward' | 'both'
		mode: PaginateModes
	}
	// document-level operations applied after the response is written to the cache.
	// @refetch records the path to a record that every dependent document should refetch.
	operations?: readonly RootOperation[]
	pluginData: Record<string, any>
}>

export type RootOperation = {
	action: 'refetch'
	type: string
	path: readonly string[]
}

export type HoudiniFetchContext = {
	variables: () => {}
}

export type FetchContext = {
	fetch: typeof globalThis.fetch
	metadata?: App.Metadata | null
	session: App.Session | null
}

export type FilterValue =
	| string
	| boolean
	| number
	| null
	| readonly FilterValue[]
	| { [key: string]: FilterValue }

export type Filter = { [key: string]: FilterValue }

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
	action: 'insert' | 'remove' | 'delete' | 'toggle' | 'upsert'
	list?: string
	type?: string
	parentID?: ValueNode
	listID?: ValueNode
	position?: 'first' | 'last'
	target?: 'all'
	// when conditions are encoded as filter nodes so that variable references
	// can be resolved when the operation is applied
	when?: {
		must?: Record<string, ListFilter>
		must_not?: Record<string, ListFilter>
	}
}

export type GraphQLObject = { [key: string]: GraphQLValue }

export type GraphQLDefaultScalar = string | number | boolean

// Extracts CacheTypeDef['componentFields'] when declared by an augmentation, otherwise never.
type CacheComponentFields = CacheTypeDef extends { componentFields: infer CF } ? CF : never

// GraphQLValue covers raw wire types, project scalar outputs (CacheTypeDef['scalars']),
// and any injected framework value such as component fields (registered via CacheTypeDef augmentation).
export type GraphQLValue =
	| GraphQLDefaultScalar
	| CacheTypeDef['scalars']
	| CacheComponentFields
	| symbol
	| null
	| GraphQLObject
	| GraphQLValue[]
	| undefined

export type GraphQLVariables = { [key: string]: any } | null | undefined

export type LoadingSpec =
	| { kind: 'continue'; list?: { depth: number; count: number } }
	| { kind: 'value'; value?: any; list?: { depth: number; count: number } }

export type ListFilter =
	| {
			kind: 'Boolean' | 'String' | 'Float' | 'Int' | 'Enum' | 'Variable'
			value: string | number | boolean
	  }
	| { kind: 'Object'; value: Record<string, ListFilter> }
	| { kind: 'List'; value: readonly ListFilter[] }

export type SubscriptionSelection = Readonly<{
	loadingTypes?: string[]
	fragments?: Record<string, { arguments: ValueMap; loading?: boolean }>
	components?: Record<string, { prop: string; attribute: string }>
	fields?: {
		[fieldName: string]: Readonly<{
			type: string
			keyRaw: string
			nullable?: boolean
			// @required directive (bubbles nullability up)
			required?: boolean
			operations?: readonly MutationOperation[]
			list?: {
				name: string
				connection: boolean
				type: string
				includeListID?: boolean
			}
			loading?: LoadingSpec
			directives?: readonly { name: string; arguments: ValueMap }[]
			updates?: readonly string[]
			visible?: boolean
			filters?: Record<string, ListFilter>
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
			optimisticKey?: boolean
		}>
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
}>

// the cache communicates with subscribers using tagged messages so that
// it can push more than just new data (for example, asking the document
// to refetch itself)
export type CacheMessage<_Data = any> =
	| {
			kind: 'update'
			data: _Data
	  }
	| {
			kind: 'refetch'
	  }

export type SubscriptionSpec = Readonly<{
	rootType: string
	// the kind of document that registered this subscription. used to decide
	// which documents a cache.refresh() should ask to refetch.
	kind?: ArtifactKinds
	selection: SubscriptionSelection
	onMessage: (message: CacheMessage) => void
	parentID?: string
	variables?: () => any
}>

export type FetchQueryResult<_Data> = {
	result: RequestPayload<_Data | null>
	source: DataSources | null
}

export type GraphQLError = {
	message: string
	locations?: readonly { line: number; column: number }[]
	path?: readonly (string | number)[]
	extensions?: App.GraphQLErrorExtensions
}

export type QueryResult<_Data = GraphQLObject, _Input = GraphQLVariables | undefined> = {
	data: _Data | null
	errors: GraphQLError[] | null
	fetching: boolean
	partial: boolean
	stale: boolean
	source: DataSources | null
	variables: _Input | null
	// response-level GraphQL extensions (e.g. the @auth mint token under
	// `houdiniSession`); present when the network response carried an extensions object
	extensions?: Record<string, any>
}

export type RequestPayload<GraphQLObject = any> = {
	data: GraphQLObject | null
	errors: GraphQLError[] | null
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
	metadata?: App.Metadata

	/**
	 * An abort controller to abort the operation
	 */
	abortController?: AbortController
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
	}) => Promise<QueryResult<_Data, _Input>>
	loadPreviousPage: (args?: {
		last?: number
		before?: string
		fetch?: typeof globalThis.fetch
		metadata?: {}
	}) => Promise<QueryResult<_Data, _Input>>
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

export const CachePolicy = {
	CacheOrNetwork: 'CacheOrNetwork',
	CacheOnly: 'CacheOnly',
	NetworkOnly: 'NetworkOnly',
	CacheAndNetwork: 'CacheAndNetwork',
	NoCache: 'NoCache',
} as const

export type CachePolicies = ValuesOf<typeof CachePolicy>

// CacheTypeDef is an interface so frameworks can augment it.
// - scalars: custom scalar output types for this project
// - componentFields: optional; frameworks augment this to register injectable component types
export interface CacheTypeDef {
	types: {}
	lists: {}
	queries: []
	scalars: boolean | number | string | Date
}
