import { extractPageInfo } from '$houdini/runtime/lib/pageInfo'
import { cursorHandlers, offsetHandlers } from '$houdini/runtime/lib/pagination'
import type {
	GraphQLObject,
	QueryArtifact,
	QueryResult,
	CursorHandlers,
	OffsetHandlers,
	PageInfo,
} from '$houdini/runtime/lib/types'
import { get, derived } from 'svelte/store'
import type { Subscriber } from 'svelte/store'

import { getClient, initClient } from '../../client'
import { getSession } from '../../session'
import type {
	ClientFetchParams,
	LoadEventFetchParams,
	QueryStoreFetchParams,
	RequestEventFetchParams,
} from '../../types'
import type { StoreConfig } from '../query'
import { QueryStore } from '../query'

export type CursorStoreResult<_Data extends GraphQLObject, _Input extends {}> = QueryResult<
	_Data,
	_Input
> & { pageInfo: PageInfo }

// both cursor paginated stores add a page info to their subscribe
export class QueryStoreCursor<_Data extends GraphQLObject, _Input extends {}> extends QueryStore<
	_Data,
	_Input
> {
	// all paginated stores need to have a flag to distinguish from other query stores
	paginated = true

	constructor(config: StoreConfig<_Data, _Input, QueryArtifact>) {
		super(config)
	}

	#_handlers: CursorHandlers<_Data, _Input> | null = null
	async #handlers(): Promise<CursorHandlers<_Data, _Input>> {
		if (this.#_handlers) {
			return this.#_handlers
		}

		// initialize the client before we compute the handlers
		await initClient()

		// we're going to use a separate observer for the page loading
		const paginationObserver = getClient().observe<_Data, _Input>({
			artifact: this.artifact,
		})

		this.#_handlers = cursorHandlers<_Data, _Input>({
			artifact: this.artifact,
			getState: () => get(this.observer).data,
			getVariables: () => get(this.observer).variables!,
			fetch: super.fetch.bind(this),
			getSession: getSession,
			fetchUpdate: async (args, updates) => {
				return paginationObserver.send({
					...args,
					cacheParams: {
						applyUpdates: updates,
						disableSubscriptions: true,
						...args?.cacheParams,
					},
				})
			},
		})

		return this.#_handlers
	}

	fetch(params?: RequestEventFetchParams<_Data, _Input>): Promise<QueryResult<_Data, _Input>>
	fetch(params?: LoadEventFetchParams<_Data, _Input>): Promise<QueryResult<_Data, _Input>>
	fetch(params?: ClientFetchParams<_Data, _Input>): Promise<QueryResult<_Data, _Input>>
	fetch(params?: QueryStoreFetchParams<_Data, _Input>): Promise<QueryResult<_Data, _Input>>
	async fetch(args?: QueryStoreFetchParams<_Data, _Input>): Promise<QueryResult<_Data, _Input>> {
		const handlers = await this.#handlers()
		return await handlers.fetch.call(this, args)
	}

	async loadPreviousPage(
		args?: Parameters<Required<CursorHandlers<_Data, _Input>>['loadPreviousPage']>[0]
	) {
		const handlers = await this.#handlers()
		return await handlers.loadPreviousPage(args)
	}

	async loadNextPage(args?: Parameters<CursorHandlers<_Data, _Input>['loadNextPage']>[0]) {
		const handlers = await this.#handlers()
		return await handlers.loadNextPage(args)
	}

	subscribe(
		run: Subscriber<CursorStoreResult<_Data, _Input>>,
		invalidate?: ((value?: CursorStoreResult<_Data, _Input> | undefined) => void) | undefined
	): () => void {
		const combined = derived([{ subscribe: super.subscribe.bind(this) }], ([$parent]) => {
			return {
				// @ts-ignore
				...$parent,
				pageInfo: extractPageInfo($parent.data, this.artifact.refetch!.path),
			}
		})

		return combined.subscribe(run, invalidate)
	}
}

export class QueryStoreOffset<_Data extends GraphQLObject, _Input extends {}> extends QueryStore<
	_Data,
	_Input
> {
	// all paginated stores need to have a flag to distinguish from other query stores
	paginated = true

	async loadNextPage(args?: Parameters<OffsetHandlers<_Data, _Input>['loadNextPage']>[0]) {
		const handlers = await this.#handlers()
		return await handlers.loadNextPage.call(this, args)
	}

	fetch(params?: RequestEventFetchParams<_Data, _Input>): Promise<QueryResult<_Data, _Input>>
	fetch(params?: LoadEventFetchParams<_Data, _Input>): Promise<QueryResult<_Data, _Input>>
	fetch(params?: ClientFetchParams<_Data, _Input>): Promise<QueryResult<_Data, _Input>>
	fetch(params?: QueryStoreFetchParams<_Data, _Input>): Promise<QueryResult<_Data, _Input>>
	async fetch(args?: QueryStoreFetchParams<_Data, _Input>): Promise<QueryResult<_Data, _Input>> {
		const handlers = await this.#handlers()
		return await handlers.fetch.call(this, args)
	}

	#_handlers: OffsetHandlers<_Data, _Input> | null = null
	async #handlers(): Promise<OffsetHandlers<_Data, _Input>> {
		if (this.#_handlers) {
			return this.#_handlers
		}
		// initialize the client before we compute the handlers
		await initClient()

		// we're going to use a separate observer for the page loading
		const paginationObserver = getClient().observe<_Data, _Input>({
			artifact: this.artifact,
		})
		this.#_handlers = offsetHandlers<_Data, _Input>({
			artifact: this.artifact,
			storeName: this.name,
			fetch: super.fetch,
			getState: () => get(this.observer).data,
			getVariables: () => get(this.observer).variables!,
			getSession: getSession,
			fetchUpdate: async (args) => {
				await initClient()
				return paginationObserver.send({
					...args,
					variables: {
						...args?.variables,
					},
					cacheParams: {
						applyUpdates: ['append'],
					},
				})
			},
		})
		return this.#_handlers
	}
}
