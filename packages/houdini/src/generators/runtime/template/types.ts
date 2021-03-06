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
	response: TypeLinks
	selection: SubscriptionSelection
	rootType: string
	operations: MutationOperation[]
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
