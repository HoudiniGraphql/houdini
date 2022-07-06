// externals
import { derived, Readable } from 'svelte/store'
// locals
import { GraphQLTagResult, Operation, QueryResult, CachePolicy } from '../lib/types'
import { wrapPaginationStore, PaginatedDocumentHandlers } from '../lib/pagination'
import { getHoudiniContext } from '../lib/context'

export function query<_Query extends Operation<any, any>>(
	document: GraphQLTagResult
): QueryResponse<_Query['result'], _Query['input']> {
	// make sure we got a query document
	if (document.kind !== 'HoudiniQuery') {
		throw new Error('query() must be passed a query document')
	}

	// build some derived stores for the atomic values
	const data = derived(document.store, ($store) => $store.data)
	const loading = derived(document.store, ($store) => $store.isFetching)
	const partial = derived(document.store, ($store) => $store.partial)
	const errors = derived(document.store, ($store) => $store.errors)

	// load the current houdini context
	const context = getHoudiniContext()

	return {
		...document.store,
		data,
		refetch: (variables?: _Query['input'], config?: RefetchConfig) => {
			return document.store.fetch({
				context,
				variables,
				policy: CachePolicy.NetworkOnly,
				...config,
			})
		},
		errors,
		loading,
		partial,
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
}

type RefetchConfig = {
	policy?: CachePolicy
}

export function paginatedQuery<_Query extends Operation<any, any>>(
	document: GraphQLTagResult
): QueryResponse<_Query['result'], _Query['input']> &
	PaginatedDocumentHandlers<_Query['result'], _Query['input']> {
	// TODO: fix type checking paginated
	// @ts-ignore: the query store will only include the methods when it needs to
	// and the userland type checking happens as part of the query type generation
	return wrapPaginationStore(query(document))
}
