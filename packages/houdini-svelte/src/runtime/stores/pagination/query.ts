import { GraphQLObject, QueryArtifact, QueryResult } from '$houdini/runtime/lib/types'
import { derived, get, Subscriber } from 'svelte/store'

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

// both cursor paginated stores add a page info to their subscribe
class CursorPaginatedStore<_Data extends GraphQLObject, _Input extends {}> extends QueryStore<
	_Data,
	_Input,
	{ pageInfo: PageInfo }
> {
	// all paginated stores need to have a flag to distinguish from other query stores
	paginated = true

	protected handlers: CursorHandlers<_Data, _Input>

	constructor(config: StoreConfig<_Data, _Input, QueryArtifact>) {
		super(config)
		this.handlers = cursorHandlers<_Data, _Input>({
			artifact: this.artifact,
			fetch: super.fetch.bind(this),
			setFetching: this.setFetching.bind(this),
			queryVariables: this.currentVariables.bind(this),
			storeName: this.name,
			getValue: () => get(this.store).data,
			getConfig: () => this.getConfig(),
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
		run: Subscriber<QueryResult<_Data, _Input, { pageInfo: PageInfo }>>,
		invalidate?:
			| ((value?: QueryResult<_Data, _Input, { pageInfo: PageInfo }> | undefined) => void)
			| undefined
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
			fetch: super.fetch,
			getValue: () => get(this.store).data,
			setFetching: (...args) => this.setFetching(...args),
			queryVariables: () => this.currentVariables(),
			storeName: this.name,
			getConfig: () => this.getConfig(),
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
