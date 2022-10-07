import { keyFieldsForType, getCurrentConfig } from '$houdini/runtime/lib/config'
import { siteURL } from '$houdini/runtime/lib/constants'
import {
	GraphQLObject,
	FragmentArtifact,
	QueryArtifact,
	HoudiniFetchContext,
	CompiledFragmentKind,
} from '$houdini/runtime/lib/types'
import { derived, get, Readable, Subscriber, Writable, writable } from 'svelte/store'

import { StoreConfig } from '../query'
import { BaseStore } from '../store'
import { cursorHandlers, CursorHandlers } from './cursor'
import { offsetHandlers } from './offset'
import { nullPageInfo, PageInfo } from './pageInfo'

type FragmentStoreConfig<_Data extends GraphQLObject, _Input> = StoreConfig<
	_Data,
	_Input,
	FragmentArtifact
> & { paginationArtifact: QueryArtifact }

class BasePaginatedFragmentStore<_Data extends GraphQLObject, _Input> extends BaseStore {
	// all paginated stores need to have a flag to distinguish from other fragment stores
	paginated = true

	protected paginationArtifact: QueryArtifact
	name: string
	kind = CompiledFragmentKind

	constructor(config: FragmentStoreConfig<_Data, _Input>) {
		super()
		this.paginationArtifact = config.paginationArtifact
		this.name = config.storeName
	}

	protected async queryVariables(
		store: Readable<FragmentPaginatedResult<_Data, unknown>>
	): Promise<_Input> {
		const config = await getCurrentConfig()

		const { targetType } = this.paginationArtifact.refetch || {}
		const typeConfig = config.types?.[targetType || '']
		if (!typeConfig) {
			throw new Error(
				`Missing type refetch configuration for ${targetType}. For more information, see ${siteURL}/guides/pagination#paginated-fragments`
			)
		}

		// if we have a specific function to use when computing the variables
		// then we need to collect those fields
		let idVariables = {}
		const value = get(store).data
		if (typeConfig.resolve?.arguments) {
			// @ts-ignore
			idVariables = (typeConfig.resolve!.arguments?.(value) || {}) as _Input
		} else {
			const keys = keyFieldsForType(config, targetType || '')
			// @ts-ignore
			idVariables = Object.fromEntries(keys.map((key) => [key, value[key]])) as _Input
		}

		// add the id variables to the query variables
		return {
			...idVariables,
		} as _Input
	}
}

// both cursor paginated stores add a page info to their subscribe
class FragmentStoreCursor<_Data extends GraphQLObject, _Input> extends BasePaginatedFragmentStore<
	_Data,
	_Input
> {
	// we want to add the cursor-based fetch to the return value of get
	get(initialValue: _Data | null) {
		const store = writable<FragmentPaginatedResult<_Data, { pageInfo: PageInfo }>>({
			data: initialValue,
			isFetching: false,
			pageInfo: nullPageInfo(),
		})

		// track the loading state
		const loading = writable(false)

		// generate the pagination handlers
		const handlers = this.storeHandlers(store, loading.set)

		const subscribe = (
			run: Subscriber<FragmentPaginatedResult<_Data, { pageInfo: PageInfo }>>,
			invalidate?:
				| ((
						value?: FragmentPaginatedResult<_Data, { pageInfo: PageInfo }> | undefined
				  ) => void)
				| undefined
		): (() => void) => {
			const combined = derived(
				[store, handlers.pageInfo],
				([$parent, $pageInfo]) =>
					({
						...$parent,
						pageInfo: $pageInfo,
					} as FragmentPaginatedResult<_Data, { pageInfo: PageInfo }>)
			)

			return combined.subscribe(run, invalidate)
		}

		return {
			kind: CompiledFragmentKind,
			data: store,
			subscribe: subscribe,
			loading: loading as Readable<boolean>,
			fetch: handlers.fetch,
			pageInfo: handlers.pageInfo,
		}
	}

	protected storeHandlers(
		store: Readable<FragmentPaginatedResult<_Data, unknown>>,
		setFetching: (val: boolean) => void
	): CursorHandlers<_Data, _Input> {
		return cursorHandlers<_Data, _Input>({
			artifact: this.paginationArtifact,
			fetch: async () => {
				return {} as any
			},
			getValue: () => get(store).data,
			queryVariables: () => this.queryVariables(store),
			setFetching,
			storeName: this.name,
			getConfig: () => this.getConfig(),
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
		const parent = super.get(initialValue)

		// generate the pagination handlers
		const handlers = this.storeHandlers(
			parent,
			// it really is a writable under the hood :(
			(isFetching: boolean) => parent.data.update((p) => ({ ...p, isFetching }))
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
		const parent = writable<FragmentPaginatedResult<_Data>>({
			data: initialValue,
			isFetching: false,
		})

		// create the offset handlers we'll add to the store
		const handlers = offsetHandlers<_Data, _Input>({
			artifact: this.paginationArtifact,
			fetch: async () => ({} as any),
			getValue: () => get(parent).data,
			setFetching: (isFetching: boolean) => parent.update((p) => ({ ...p, isFetching })),
			queryVariables: () => this.queryVariables({ subscribe: parent.subscribe }),
			storeName: this.name,
			getConfig: () => this.getConfig(),
		})

		// add the offset handlers
		return {
			...parent,
			kind: CompiledFragmentKind,
			fetch: handlers.fetch,
			loadNextPage: handlers.loadNextPage,
		}
	}
}

export type FragmentStorePaginated<_Data extends GraphQLObject, _Input> = Readable<{
	data: _Data
	isFetching: boolean
	pageInfo: PageInfo
}> & {
	loadNextPage(
		pageCount?: number,
		after?: string | number,
		houdiniContext?: HoudiniFetchContext
	): Promise<void>
	loadPreviousPage(
		pageCount?: number,
		before?: string,
		houdiniContext?: HoudiniFetchContext
	): Promise<void>
}

export type FragmentPaginatedResult<_Data, _ExtraFields = {}> = {
	data: _Data | null
	isFetching: boolean
} & _ExtraFields
