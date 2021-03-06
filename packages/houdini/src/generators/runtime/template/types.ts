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

type Module<T> = Promise<{ default: T }>

export type Maybe<T> = T | null

export type TaggedGraphqlFragment = {
	name: string
	kind: 'HoudiniFragment'
	selection: SubscriptionSelection
	rootType: string
}

// the result of tagging an operation
export type TaggedGraphqlMutation = {
	name: string
	kind: 'HoudiniMutation'
	raw: string
	links: Module<() => { [queryName: string]: Module<Patch> }>
	response: TypeLinks
	selection: SubscriptionSelection
	rootType: string
}

// the result of tagging an operation
export type TaggedGraphqlQuery = {
	name: string
	kind: 'HoudiniQuery'
	raw: string
	initialValue: any
	variables: { [key: string]: any }
	response: TypeLinks
	selection: SubscriptionSelection
	rootType: string
}

// the result of the template tag
export type GraphQLTagResult = TaggedGraphqlQuery | TaggedGraphqlFragment | TaggedGraphqlMutation

type Filter = { [key: string]: string | boolean | number }

export type ConnectionWhen = {
	must?: Filter
	must_not?: Filter
}

// another intermediate type used when building up the mutation description
export type PatchAtom = {
	operation: 'add' | 'remove' | 'update' | 'delete'
	mutationName: string
	mutationPath: string[]
	queryName: string
	queryPath: string[]
	// connection fields
	parentID?: {
		kind: 'Variable' | 'String' | 'Root'
		value: string
	}
	when?: ConnectionWhen
	connectionName?: string
	position?: 'start' | 'end'
}

// a description of an interaction between a mutation and a query
export type Patch = {
	operations?: {
		[op in PatchAtom['operation']]?: {
			parentID: {
				kind: 'String' | 'Variable' | 'Root'
				value: string
			}
			position: 'start' | 'end'
			path: string[]
			when?: ConnectionWhen
			connectionName?: string
		}[]
	}
	fields?: { [fieldName: string]: Array<string[]> }
	edges?: { [path: string]: Patch }
}
