import type { DocumentStore } from '$houdini/runtime/client'
import { getCurrentConfig, keyFieldsForType } from '$houdini/runtime/lib/config'
import { siteURL } from '$houdini/runtime/lib/constants'
import type {
	FragmentArtifact,
	GraphQLObject,
	HoudiniFetchContext,
	QueryArtifact,
} from '$houdini/runtime/lib/types'
import { CompiledFragmentKind } from '$houdini/runtime/lib/types'
import type { Readable, Subscriber } from 'svelte/store'
import { derived, get } from 'svelte/store'

import { getClient, initClient } from '../../client'
import type { CursorHandlers, OffsetFragmentStoreInstance } from '../../types'
import { FragmentStore } from '../fragment'
import type { StoreConfig } from '../query'
import { cursorHandlers } from './cursor'
import { offsetHandlers } from './offset'
import { extractPageInfo, type PageInfo } from './pageInfo'

type FragmentStoreConfig<_Data extends GraphQLObject, _Input> = StoreConfig<
	_Data,
	_Input,
	FragmentArtifact
> & { paginationArtifact: QueryArtifact }

class BasePaginatedFragmentStore<_Data extends GraphQLObject, _Input> {
	// all paginated stores need to have a flag to distinguish from other fragment stores
	paginated = true

	protected paginationArtifact: QueryArtifact
	name: string
	kind = CompiledFragmentKind
	artifact: FragmentArtifact

	constructor(config: FragmentStoreConfig<_Data, _Input>) {
		this.paginationArtifact = config.paginationArtifact
		this.name = config.storeName
		this.artifact = config.artifact
	}

	protected queryVariables(store: Readable<FragmentPaginatedResult<_Data, unknown>>): _Input {
		const config = getCurrentConfig()

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
export class FragmentStoreCursor<
	_Data extends GraphQLObject,
	_Input extends Record<string, any>
> extends BasePaginatedFragmentStore<_Data, _Input> {
	// we want to add the cursor-based fetch to the return value of get
	get(initialValue: _Data | null) {
		const base = new FragmentStore<_Data, _Input>({
			artifact: this.artifact,
			storeName: this.name,
		})
		const store = base.get(initialValue)

		// generate the pagination handlers
		const paginationStore = getClient().observe<_Data, _Input>({
			artifact: this.paginationArtifact,
			initialValue: store.initialValue,
		})
		const handlers = this.storeHandlers(paginationStore)

		const subscribe = (
			run: Subscriber<FragmentPaginatedResult<_Data, { pageInfo: PageInfo }>>,
			invalidate?:
				| ((
						value?: FragmentPaginatedResult<_Data, { pageInfo: PageInfo }> | undefined
				  ) => void)
				| undefined
		): (() => void) => {
			const combined = derived([store, paginationStore], ([$parent, $pagination]) => {
				return {
					...$pagination,
					data: $parent,
					pageInfo: extractPageInfo(
						$pagination?.data,
						this.paginationArtifact.refetch!.path
					),
				} as FragmentPaginatedResult<_Data, { pageInfo: PageInfo }>
			})

			return combined.subscribe(run, invalidate)
		}

		return {
			kind: CompiledFragmentKind,
			data: derived(store, ($value) => $value),
			subscribe: subscribe,
			fetching: derived([paginationStore], ([$store]) => $store.fetching),
			fetch: handlers.fetch,
			pageInfo: handlers.pageInfo,

			// add the pagination handlers
			loadNextPage: handlers.loadNextPage,
			loadPreviousPage: handlers.loadPreviousPage,
		}
	}

	protected storeHandlers(observer: DocumentStore<_Data, _Input>): CursorHandlers<_Data, _Input> {
		return cursorHandlers<_Data, _Input>({
			artifact: this.paginationArtifact,
			fetchUpdate: async (args, updates) => {
				await initClient()

				return observer.send({
					...args,
					variables: {
						...args?.variables,
						...this.queryVariables(observer),
					},
					cacheParams: {
						applyUpdates: updates,
					},
				})
			},
			fetch: async (args) => {
				await initClient()

				return await observer.send({
					...args,
					variables: {
						...args?.variables,
						...this.queryVariables(observer),
					},
				})
			},
			observer,
			storeName: this.name,
		})
	}
}

export class FragmentStoreOffset<
	_Data extends GraphQLObject,
	_Input extends Record<string, any>
> extends BasePaginatedFragmentStore<_Data, _Input> {
	get(initialValue: _Data | null): OffsetFragmentStoreInstance<_Data, _Input> {
		const base = new FragmentStore<_Data, _Input>({
			artifact: this.artifact,
			storeName: this.name,
		})
		const store = base.get(initialValue)

		// generate the pagination handlers
		const observer = getClient().observe<_Data, _Input>({
			artifact: this.paginationArtifact,
			initialValue,
		})

		// create the offset handlers we'll add to the store
		const handlers = offsetHandlers<_Data, _Input>({
			artifact: this.paginationArtifact,
			fetch: async (args) => {
				return observer.send({
					...args,
					variables: {
						...this.queryVariables(observer),
						...args?.variables,
					},
				})
			},
			fetchUpdate: async (args) => {
				return observer.send({
					...args,
					variables: {
						...this.queryVariables(observer),
						...args?.variables,
					},
					cacheParams: {
						applyUpdates: ['append'],
					},
				})
			},
			observer,
			storeName: this.name,
		})

		// add the offset handlers
		return {
			kind: CompiledFragmentKind,
			data: derived(observer, ($value) => $value.data!),
			// @ts-ignore
			subscribe: store.subscribe,
			fetch: handlers.fetch,
			loadNextPage: handlers.loadNextPage,
			fetching: derived(observer, ($store) => $store.fetching),
		}
	}
}

export type FragmentStorePaginated<_Data extends GraphQLObject, _Input> = Readable<{
	data: _Data
	fetching: boolean
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
	fetching: boolean
} & _ExtraFields
