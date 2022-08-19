import { derived, Readable } from 'svelte/store'

import { getHoudiniContext } from '../lib/context'
import { GraphQLTagResult, Operation, CachePolicy, CompiledQueryKind } from '..'
import { QueryStorePaginated } from '../stores/pagination/query'
import { QueryResult, QueryStore } from '../stores/query'
import { CursorHandlers } from '../stores/pagination/cursor'

export function query<_Query extends Operation<any, any>>(
	store: GraphQLTagResult
): QueryResponse<_Query['result'], _Query['input']> {
	// make sure we got a query document
	if (store.kind !== CompiledQueryKind) {
		throw new Error('query() must be passed a query document')
	}
	const queryStore = store as QueryStore<any, unknown>

	// build some derived stores for the atomic values
	const data = derived(queryStore, ($store) => $store.data)
	const loading = derived(queryStore, ($store) => $store.isFetching)
	const partial = derived(queryStore, ($store) => $store.partial)
	const errors = derived(queryStore, ($store) => $store.errors)
	const variables = derived(queryStore, ($store) => $store.variables)

	// load the current houdini context
	const context = getHoudiniContext()

	return {
		...store,
		data,
		refetch: (variables?: _Query['input'], config?: RefetchConfig) => {
			return queryStore.fetch({
				context,
				variables,
				policy: CachePolicy.NetworkOnly,
				...config,
			})
		},
		errors,
		loading,
		partial,
		variables,
	}
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
): QueryResponse<_Query['result'], _Query['input']> &
	CursorHandlers<_Query['result'], _Query['input']> {
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
	return {
		...query(store),
		// @ts-ignore
		pageInfo: store.pageInfo,
		// @ts-ignore
		loadNextPage: store.loadNextPage?.bind(store),
		// @ts-ignore
		loadPreviousPage: store.loadPreviousPage?.bind(store),
	}
}
