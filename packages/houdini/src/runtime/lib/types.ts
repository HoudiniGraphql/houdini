export const CachePolicy = {
	CacheOrNetwork: 'CacheOrNetwork',
	CacheOnly: 'CacheOnly',
	NetworkOnly: 'NetworkOnly',
	CacheAndNetwork: 'CacheAndNetwork',
} as const

type ValuesOf<Target> = Target[keyof Target]

export type CachePolicies = ValuesOf<typeof CachePolicy>

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
}

export type MutationArtifact = BaseCompiledDocument<'HoudiniMutation'>

export type FragmentArtifact = BaseCompiledDocument<'HoudiniFragment'>

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
	refetch?: {
		path: string[]
		method: 'cursor' | 'offset'
		pageSize: number
		start?: string | number
		embedded: boolean
		targetType: string
		paginated: boolean
		direction: 'forward' | 'backward' | 'both'
	}
	pluginData?: Record<string, any>
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

export type SubscriptionSelection = {
	fields?: {
		[fieldName: string]: {
			type: string
			nullable?: boolean
			keyRaw: string
			operations?: MutationOperation[]
			list?: {
				name: string
				connection: boolean
				type: string
			}
			updates?: string[]
			filters?: {
				[key: string]: {
					kind: 'Boolean' | 'String' | 'Float' | 'Int' | 'Variable'
					value: string | number | boolean
				}
			}
			selection?: SubscriptionSelection
			abstract?: boolean
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

export type QueryResult<_Data = GraphQLObject, _Input = Record<string, any>> = {
	data: _Data | null
	errors: { message: string }[] | null
	fetching: boolean
	partial: boolean
	stale: boolean
	source: DataSources | null
	variables: _Input | {}
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
