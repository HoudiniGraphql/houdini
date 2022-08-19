import { get, Writable, writable } from 'svelte/store'

import { GraphQLObject, HoudiniFetchContext, QueryArtifact } from '../../lib'
import {
	QueryStore,
	StoreConfig,
	LoadEventFetchParams,
	RequestEventFetchParams,
	QueryStoreFetchParams,
	ClientFetchParams,
	QueryResult,
} from '../query'
import { nullPageInfo, PageInfo } from './pageInfo'
import { CursorHandlers, cursorHandlers } from './cursor'
import { offsetHandlers, OffsetHandlers } from './offset'

// both cursor paginated stores add a page info to their subscribe
class CursorPaginatedStore<_Data extends GraphQLObject, _Input> extends QueryStore<_Data, _Input> {
	// all paginated stores need to have a flag to distinguish from other query stores
	paginated = true

	protected handlers: CursorHandlers<_Data, _Input>

	constructor(config: StoreConfig<_Data, _Input, QueryArtifact>) {
		super(config)
		this.handlers = cursorHandlers<_Data, _Input>({
			artifact: this.artifact,
			fetch: super.fetch,
			setFetching: this.setFetching,
			queryVariables: this.currentVariables,
			storeName: this.name,
			getContext: () => this.context,
			getValue: () => get(this.store).data,
		})
	}

	fetch(params?: RequestEventFetchParams<_Input>): Promise<QueryResult<_Data, _Input>>
	fetch(params?: LoadEventFetchParams<_Input>): Promise<QueryResult<_Data, _Input>>
	fetch(params?: ClientFetchParams<_Input>): Promise<QueryResult<_Data, _Input>>
	fetch(params?: QueryStoreFetchParams<_Input>): Promise<QueryResult<_Data, _Input>>
	async fetch(args?: QueryStoreFetchParams<_Input>): Promise<QueryResult<_Data, _Input>> {
		return this.handlers!.fetch(args)
	}

	get pageInfo() {
		return this.handlers.pageInfo
	}
}

// QueryStoreForwardCursor adds loadNextPage to CursorPaginatedQueryStore
export class QueryStoreForwardCursor<
	_Data extends GraphQLObject,
	_Input
> extends CursorPaginatedStore<_Data, _Input> {
	async loadNextPage(pageCount?: number, after?: string, ctx?: HoudiniFetchContext) {
		return this.handlers.loadNextPage(pageCount, after, ctx)
	}
}

// QueryStoreBackwardCursor adds loadPreviousPage to CursorPaginatedQueryStore
export class QueryStoreBackwardCursor<
	_Data extends GraphQLObject,
	_Input
> extends CursorPaginatedStore<_Data, _Input> {
	async loadPreviousPage(pageCount?: number, before?: string, ctx?: HoudiniFetchContext) {
		return this.handlers.loadPreviousPage(pageCount, before, ctx)
	}
}

export class QueryStoreOffset<_Data extends GraphQLObject, _Input> extends QueryStore<
	_Data,
	_Input
> {
	// all paginated stores need to have a flag to distinguish from other query stores
	paginated = true

	protected handlers: OffsetHandlers<_Data, _Input, QueryResult<_Data, _Input>>

	constructor(config: StoreConfig<_Data, _Input, QueryArtifact>) {
		super(config)
		this.handlers = offsetHandlers<_Data, _Input>({
			artifact: this.artifact,
			fetch: super.fetch,
			getContext: () => this.context,
			getValue: () => get(this.store).data,
			setFetching: this.setFetching,
			queryVariables: this.currentVariables,
			storeName: this.name,
		})
	}

	async loadPage(limit?: number, offset?: number, ctx?: HoudiniFetchContext) {
		return this.handlers.loadPage(limit, offset, ctx)
	}

	fetch(params?: RequestEventFetchParams<_Input>): Promise<QueryResult<_Data, _Input>>
	fetch(params?: LoadEventFetchParams<_Input>): Promise<QueryResult<_Data, _Input>>
	fetch(params?: ClientFetchParams<_Input>): Promise<QueryResult<_Data, _Input>>
	fetch(params?: QueryStoreFetchParams<_Input>): Promise<QueryResult<_Data, _Input>>
	fetch(args?: QueryStoreFetchParams<_Input>): Promise<QueryResult<_Data, _Input>> {
		return this.handlers.fetch(args)
	}
}

export type QueryStorePaginated<_Data extends GraphQLObject, _Input> =
	| QueryStoreOffset<_Data, _Input>
	| QueryStoreForwardCursor<_Data, _Input>
	| QueryStoreBackwardCursor<_Data, _Input>
