import { GraphQLObject, QueryArtifact, QueryResult } from '$houdini/runtime/lib/types'
import { derived, Subscriber } from 'svelte/store'

import {
	ClientFetchParams,
	LoadEventFetchParams,
	QueryStore,
	QueryStoreFetchParams,
	RequestEventFetchParams,
	StoreConfig,
} from '../query'
import { CursorHandlers, cursorHandlers } from './cursor'
import { offsetHandlers, OffsetHandlers } from './offset'
import { nullPageInfo, PageInfo } from './pageInfo'

export type CursorStoreResult<_Data extends GraphQLObject, _Input extends {}> = QueryResult<
	_Data,
	_Input
> & { pageInfo: PageInfo }

// both cursor paginated stores add a page info to their subscribe
class CursorPaginatedStore<_Data extends GraphQLObject, _Input extends {}> extends QueryStore<
	_Data,
	_Input
> {
	// all paginated stores need to have a flag to distinguish from other query stores
	paginated = true

	protected handlers: CursorHandlers<_Data, _Input>

	constructor(config: StoreConfig<_Data, _Input, QueryArtifact>) {
		super(config)
		this.handlers = cursorHandlers<_Data, _Input>({
			artifact: this.artifact,
			observer: this.observer,
			storeName: this.name,
			fetch: super.fetch,
		})
	}

	fetch(params?: RequestEventFetchParams<_Data, _Input>): Promise<QueryResult<_Data, _Input>>
	fetch(params?: LoadEventFetchParams<_Data, _Input>): Promise<QueryResult<_Data, _Input>>
	fetch(params?: ClientFetchParams<_Data, _Input>): Promise<QueryResult<_Data, _Input>>
	fetch(params?: QueryStoreFetchParams<_Data, _Input>): Promise<QueryResult<_Data, _Input>>
	async fetch(args?: QueryStoreFetchParams<_Data, _Input>): Promise<QueryResult<_Data, _Input>> {
		return this.handlers!.fetch.call(this, args)
	}

	extraFields(): { pageInfo: PageInfo } {
		return {
			pageInfo: nullPageInfo(),
		}
	}

	subscribe(
		run: Subscriber<CursorStoreResult<_Data, _Input>>,
		invalidate?: ((value?: CursorStoreResult<_Data, _Input> | undefined) => void) | undefined
	): () => void {
		const combined = derived(
			[{ subscribe: super.subscribe.bind(this) }, this.handlers.pageInfo],
			([$parent, $pageInfo]) => ({
				// @ts-ignore
				...$parent,
				pageInfo: $pageInfo,
			})
		)

		return combined.subscribe(run, invalidate)
	}
}

// QueryStoreForwardCursor adds loadNextPage to CursorPaginatedQueryStore
export class QueryStoreForwardCursor<
	_Data extends GraphQLObject,
	_Input extends {}
> extends CursorPaginatedStore<_Data, _Input> {
	async loadNextPage(args?: Parameters<CursorHandlers<_Data, _Input>['loadNextPage']>[0]) {
		return this.handlers.loadNextPage(args)
	}
}

// QueryStoreBackwardCursor adds loadPreviousPage to CursorPaginatedQueryStore
export class QueryStoreBackwardCursor<
	_Data extends GraphQLObject,
	_Input extends {}
> extends CursorPaginatedStore<_Data, _Input> {
	async loadPreviousPage(
		args?: Parameters<Required<CursorHandlers<_Data, _Input>>['loadPreviousPage']>[0]
	) {
		return this.handlers.loadPreviousPage(args)
	}
}

export class QueryStoreOffset<_Data extends GraphQLObject, _Input extends {}> extends QueryStore<
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
			observer: this.observer,
			storeName: this.name,
			fetch: super.fetch,
		})
	}

	async loadNextPage(
		args?: Parameters<
			OffsetHandlers<_Data, _Input, QueryResult<_Data, _Input>>['loadNextPage']
		>[0]
	) {
		return this.handlers.loadNextPage.call(this, args)
	}

	fetch(params?: RequestEventFetchParams<_Data, _Input>): Promise<QueryResult<_Data, _Input>>
	fetch(params?: LoadEventFetchParams<_Data, _Input>): Promise<QueryResult<_Data, _Input>>
	fetch(params?: ClientFetchParams<_Data, _Input>): Promise<QueryResult<_Data, _Input>>
	fetch(params?: QueryStoreFetchParams<_Data, _Input>): Promise<QueryResult<_Data, _Input>>
	fetch(args?: QueryStoreFetchParams<_Data, _Input>): Promise<QueryResult<_Data, _Input>> {
		return this.handlers.fetch.call(this, args)
	}
}
