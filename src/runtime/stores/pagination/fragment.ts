import { get, readable, Readable, Writable, writable } from 'svelte/store'

import {
	GraphQLObject,
	FragmentArtifact,
	getCurrentConfig,
	QueryArtifact,
	keyFieldsForType,
	CompiledFragmentKind,
} from '../../lib'
import { ClientFetchParams, QueryResult, StoreConfig } from '../query'
import { FragmentStore } from '../fragment'
import { nullPageInfo, PageInfo } from './pageInfo'
import { offsetHandlers } from './offset'
import { cursorHandlers, CursorHandlers } from './cursor'

type FragmentStoreConfig<_Data extends GraphQLObject, _Input> = StoreConfig<
	_Data,
	_Input,
	FragmentArtifact
> & { paginationArtifact: QueryArtifact }

class BasePaginatedFragmentStore<_Data extends GraphQLObject, _Input> extends FragmentStore<
	_Data,
	_Input
> {
	// all paginated stores need to have a flag to distinguish from other fragment stores
	paginated = true

	protected paginationArtifact: QueryArtifact

	constructor(config: FragmentStoreConfig<_Data, _Input>) {
		super(config)
		this.paginationArtifact = config.paginationArtifact
	}

	protected async queryVariables(store: Readable<_Data | null>) {
		const config = await getCurrentConfig()

		const { targetType } = this.paginationArtifact.refetch || {}
		const typeConfig = config.types?.[targetType || '']
		if (!typeConfig) {
			throw new Error(
				`Missing type refetch configuration for ${targetType}. For more information, see https://www.houdinigraphql.com/guides/pagination#paginated-fragments`
			)
		}
		// if we have a specific function to use when computing the variables
		const value = get(store)
		if (typeConfig.resolve?.arguments) {
			return (typeConfig.resolve!.arguments?.(value) || {}) as _Input
		} else {
			const keys = keyFieldsForType(config, targetType || '')

			// @ts-ignore
			return Object.fromEntries(keys.map((key) => [key, value[key]])) as _Input
		}
	}
}

// both cursor paginated stores add a page info to their subscribe
class FragmentStoreCursor<_Data extends GraphQLObject, _Input> extends BasePaginatedFragmentStore<
	_Data,
	_Input
> {
	// we want to add the cursor-based fetch to the return value of get
	get(initialValue: _Data | null) {
		const parent = super.get(initialValue)

		// track the loading state
		const loading = writable(false)

		// generate the pagination handlers
		const handlers = this.storeHandlers(parent, loading.set)

		return {
			...parent,
			// mark it as a readable even tho it's actually writable (the user shouldn't ever write to it)
			loading: loading as Readable<boolean>,
			fetch: handlers.fetch,
			pageInfo: handlers.pageInfo,
		}
	}

	protected storeHandlers(
		store: Readable<_Data | null>,
		setFetching: (val: boolean) => void
	): CursorHandlers<_Data, _Input> {
		return cursorHandlers<_Data, _Input>({
			artifact: this.paginationArtifact,
			fetch: async () => {
				return {} as any
			},
			getContext: () => this.context,
			getValue: () => get(store),
			queryVariables: () => this.queryVariables(store),
			setFetching,
			storeName: this.name,
		})
	}
}

// FragmentStoreForwardCursor adds loadNextPage to FragmentStoreCursor
export class FragmentStoreForwardCursor<
	_Data extends GraphQLObject,
	_Input
> extends FragmentStoreCursor<_Data, _Input> {
	get(initialValue: _Data | null) {
		// get the base class
		const parent = super.get(initialValue)

		// generate the pagination handlers
		const handlers = this.storeHandlers(
			parent,
			// it really is a writable under the hood :(
			(parent.loading as unknown as Writable<boolean>).set
		)

		return {
			...parent,
			// add the specific handlers for this situation
			loadNextPage: handlers.loadNextPage,
		}
	}
}

// BackwardFragmentStoreCursor adds loadPreviousPage to FragmentStoreCursor
export class FragmentStoreBackwardCursor<
	_Data extends GraphQLObject,
	_Input
> extends FragmentStoreCursor<_Data, _Input> {
	get(initialValue: _Data | null) {
		// get the base class
		const parent = super.get(initialValue)

		// generate the pagination handlers
		const handlers = this.storeHandlers(
			parent,
			// it really is a writable under the hood :(
			(parent.loading as unknown as Writable<boolean>).set
		)

		return {
			...parent,
			// add the specific handlers for this situation
			loadPreviousPage: handlers.loadPreviousPage,
		}
	}
}

export class FragmentStoreOffset<
	_Data extends GraphQLObject,
	_Input
> extends BasePaginatedFragmentStore<_Data, _Input> {
	get(initialValue: _Data | null) {
		const parent = super.get(initialValue)

		const loading = writable(false)

		// create the offset handlers we'll add to the store
		const handlers = offsetHandlers<_Data, _Input>({
			artifact: this.paginationArtifact,
			fetch: async () => ({} as any),
			getContext: () => this.context,
			getValue: () => get(parent),
			setFetching: loading.set,
			queryVariables: () => this.queryVariables({ subscribe: parent.subscribe }),
			storeName: this.name,
		})

		// add the offset handlers
		return {
			...parent,
			loading: { subscribe: loading.subscribe },
			fetch: handlers.fetch,
			loadPage: handlers.loadPage,
		}
	}
}

export type FragmentStorePaginated<_Data extends GraphQLObject, _Input> =
	| FragmentStoreBackwardCursor<_Data, _Input>
	| FragmentStoreForwardCursor<_Data, _Input>
	| FragmentStoreOffset<_Data, _Input>

export interface QueryStorePaginated<_Data extends GraphQLObject, _Input> {
	kind: typeof CompiledFragmentKind

	fetch(params?: ClientFetchParams<_Input>): Promise<QueryResult<_Data, _Input>>

	loadNextPage: CursorHandlers<_Data, _Input>['loadNextPage']
	loadPreviousPage: CursorHandlers<_Data, _Input>['loadPreviousPage']
	loadPage: CursorHandlers<_Data, _Input>['pageInfo']
}
