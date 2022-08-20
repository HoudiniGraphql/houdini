import { derived, Readable } from 'svelte/store'

import { QueryStorePaginated } from '..'
import { getHoudiniContext } from '../lib/context'
import { GraphQLTagResult, Operation, CachePolicy, CompiledQueryKind } from '../lib/types'
import { CursorHandlers } from '../stores/pagination/cursor'
import { QueryResult, QueryStore } from '../stores/query'

export function query<_Query extends Operation<any, any>>(
	store: GraphQLTagResult
): QueryStore<_Query['result'], _Query['input']> {
	// make sure we got a query document
	if (store.kind !== CompiledQueryKind) {
		throw new Error('query() must be passed a query document')
	}

	// set the store's context
	store.setContext(getHoudiniContext())

	return store as QueryStore<_Query['result'], _Query['input']>
}

// we need to wrap the response from a query in something that we can
// use as a proxy to the query for refetches, writing to the cache, etc
export type QueryResponse<_Data, _Input> = {
	data: Readable<_Data>
	refetch: (input?: _Input, config?: RefetchConfig) => Promise<QueryResult<_Data, _Input>>
	loading: Readable<boolean>
	partial: Readable<boolean>
	errors: Readable<{ message: string }[] | null>
	variables: Readable<_Input>
}

type RefetchConfig = {
	policy?: CachePolicy
}

export function paginatedQuery<_Query extends Operation<any, any>>(
	store: GraphQLTagResult
): QueryStorePaginated<_Query['result'], _Query['input']> {
	// make sure we got a query document
	if (store.kind !== 'HoudiniQuery') {
		throw new Error('paginatedQuery() must be passed a query document')
	}
	// if we don't have a pagination query there is a problem
	if (!('paginated' in store)) {
		throw new Error('paginatedQuery() must be passed a query with @paginate')
	}

	// TODO: fix type checking paginated
	// @ts-ignore: the query store will only include the methods when it needs to
	// and the userland type checking happens as part of the query type generation
	return query(store)
}
