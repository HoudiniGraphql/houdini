import { getCurrentConfig } from '$houdini/runtime'
import type { DocumentStore } from '$houdini/runtime/client'
import { keyFieldsForType } from 'houdini/runtime'
import { siteURL } from 'houdini/runtime'
import { extractPageInfo } from 'houdini/runtime'
import { cursorHandlers, offsetHandlers } from 'houdini/runtime'
import { fragmentKey } from 'houdini/runtime'
import type {
	CachePolicies,
	FragmentArtifact,
	GraphQLObject,
	GraphQLError,
	HoudiniFetchContext,
	QueryArtifact,
	PageInfo,
	CursorHandlers,
	GraphQLVariables,
} from 'houdini/runtime'
import { CompiledFragmentKind } from 'houdini/runtime'
import type { Readable, Subscriber } from 'svelte/store'
import { derived, get } from 'svelte/store'

import { getClient, initClient } from '../../client.js'
import { getSession } from '../../session.js'
import type { OffsetFragmentStoreInstance } from '../../types.js'
import { FragmentStore } from '../fragment.js'
import type { StoreConfig } from '../query.js'

type FragmentStoreConfig<_Data extends GraphQLObject, _Input> = StoreConfig<
	_Data,
	_Input,
	FragmentArtifact
> & { paginationArtifact: QueryArtifact }

export class BasePaginatedFragmentStore<
	_Data extends GraphQLObject,
	_ReferenceType extends {},
	_Input,
> {
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

	protected queryVariables(getState: () => _Data | null): _Input {
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
		let idVariables: _Input = {} as _Input
		const value = getState()
		if (typeConfig.resolve?.arguments) {
			idVariables = (typeConfig.resolve!.arguments?.(value) || {}) as _Input
		} else {
			const keys = keyFieldsForType(config, targetType || '')
			idVariables = Object.fromEntries(keys.map((key) => [key, value![key]])) as _Input
		}

		// add the id variables to the query variables
		return {
			...idVariables,
		} as _Input
	}
}

// Keyed by "<artifactName>:<entityID>" so reactive re-invocations of get() don't reset cursor history.
type _SinglePageState = {
	paginationStore: DocumentStore<any, any>
	previousCursors: (string | null)[]
	nextCursors: (string | null)[]
}
const _singlePageStateCache = new Map<string, _SinglePageState>()

// both cursor paginated stores add a page info to their subscribe
export class FragmentStoreCursor<
	_Data extends GraphQLObject,
	_ReferenceType extends {},
	_Input extends GraphQLVariables,
> extends BasePaginatedFragmentStore<_Data, _ReferenceType, _Input> {
	// we want to add the cursor-based fetch to the return value of get
	get(initialValue: _Data | { [fragmentKey]: _ReferenceType } | null) {
		const base = new FragmentStore<_Data, {}, _Input>({
			artifact: this.artifact,
			storeName: this.name,
		})
		const store = base.get(initialValue)

		const isSinglePage = this.paginationArtifact.refetch?.mode === 'SinglePage'

		let paginationStore: DocumentStore<_Data, _Input>
		let previousCursors: (string | null)[]
		let nextCursors: (string | null)[]

		if (isSinglePage) {
			const parent = (initialValue as any)?.[fragmentKey]?.values?.[this.artifact.name]
				?.parent
			const stateKey = parent ? `${this.paginationArtifact.name}:${parent}` : null
			const cached = stateKey ? _singlePageStateCache.get(stateKey) : null

			if (cached) {
				paginationStore = cached.paginationStore
				previousCursors = cached.previousCursors
				nextCursors = cached.nextCursors
			} else {
				paginationStore = getClient().observe<_Data, _Input>({
					artifact: this.paginationArtifact,
					initialValue: store.initialValue,
				})
				previousCursors = []
				nextCursors = []
				if (stateKey) {
					_singlePageStateCache.set(stateKey, {
						paginationStore,
						previousCursors,
						nextCursors,
					})
				}
			}
		} else {
			paginationStore = getClient().observe<_Data, _Input>({
				artifact: this.paginationArtifact,
				initialValue: store.initialValue,
			})
			previousCursors = []
			nextCursors = []
		}

		// First key of paginationArtifact.selection.fields is the query-level root (e.g. "user").
		// initialValue is fragment-level data with no such wrapper, so wrapped is null until
		// the first paginated fetch completes.
		const rootField = isSinglePage
			? Object.keys(this.paginationArtifact.selection.fields ?? {})[0]
			: null

		const getPaginationEntity = (): _Data | null => {
			if (!isSinglePage || !rootField) return null
			const $pagination = get(paginationStore)
			if (!$pagination.data) return null
			const wrapped = ($pagination.data as any)?.[rootField]
			if (!wrapped) return null
			return wrapped as _Data
		}

		const handlers = this.storeHandlers(
			paginationStore,
			store.initialValue,
			() => getPaginationEntity() ?? get(store),
			() => {
				if (!isSinglePage) return store.variables as NonNullable<_Input>
				const paginationVars = get(paginationStore).variables
				if (paginationVars) return paginationVars as NonNullable<_Input>
				return store.variables as NonNullable<_Input>
			},
			previousCursors,
			nextCursors
		)

		const subscribe = (
			run: Subscriber<FragmentPaginatedResult<_Data, { pageInfo: PageInfo }>>,
			invalidate?:
				| ((
						value?: FragmentPaginatedResult<_Data, { pageInfo: PageInfo }> | undefined
				  ) => void)
				| undefined
		): (() => void) => {
			const combined = derived([store, paginationStore], ([$parent, $pagination]) => {
				let currentData: _Data | null
				if (isSinglePage && rootField) {
					const wrapped = ($pagination.data as any)?.[rootField]
					currentData = wrapped ? (wrapped as _Data) : $parent
				} else {
					currentData = $parent
				}
				return {
					...$pagination,
					data: currentData,
					pageInfo: extractPageInfo(currentData, this.paginationArtifact.refetch!.path),
				} as FragmentPaginatedResult<_Data, { pageInfo: PageInfo }>
			})

			return combined.subscribe(run, invalidate)
		}

		return {
			kind: CompiledFragmentKind,
			subscribe: subscribe,
			fetch: handlers.fetch,
			loadNextPage: handlers.loadNextPage,
			loadPreviousPage: handlers.loadPreviousPage,
		}
	}

	protected storeHandlers(
		observer: DocumentStore<_Data, _Input>,
		_initialValue: _Data | null,
		getState: () => _Data | null,
		getVariables: () => NonNullable<_Input>,
		previousCursors?: (string | null)[],
		nextCursors?: (string | null)[]
	): CursorHandlers<_Data, _Input> {
		return cursorHandlers<_Data, _Input>({
			getState,
			getVariables,
			artifact: this.paginationArtifact,
			fetchUpdate: async (args, updates) => {
				await initClient()

				// undefined entity vars would shadow the id cursorHandlers resolved via getVariables()
				const entityVars = Object.fromEntries(
					Object.entries(this.queryVariables(getState) as any).filter(
						([, v]) => v !== undefined
					)
				) as _Input

				return observer.send({
					session: await getSession(),
					...args,
					variables: {
						...args?.variables,
						...entityVars,
					},
					cacheParams: {
						applyUpdates: updates,
						disableSubscriptions: true,
					},
				})
			},
			fetch: async (args) => {
				await initClient()

				const entityVars = Object.fromEntries(
					Object.entries(this.queryVariables(getState) as any).filter(
						([, v]) => v !== undefined
					)
				) as _Input

				const resolvedVars = { ...args?.variables, ...entityVars }

				return await observer.send({
					session: await getSession(),
					...args,
					variables: resolvedVars,
					policy: args?.policy,
					cacheParams: {
						disableSubscriptions: true,
					},
				})
			},
			getSession,
			previousCursors,
			nextCursors,
		})
	}
}

export class FragmentStoreOffset<
	_Data extends GraphQLObject,
	_ReferenceType extends {},
	_Input extends GraphQLVariables,
> extends BasePaginatedFragmentStore<_Data, _ReferenceType, _Input> {
	get(initialValue: _Data | null): OffsetFragmentStoreInstance<_Data, _Input> {
		const base = new FragmentStore<_Data, {}, _Input>({
			artifact: this.artifact,
			storeName: this.name,
		})
		const store = base.get(initialValue)

		// generate the pagination handlers
		const paginationStore = getClient().observe<_Data, _Input>({
			artifact: this.paginationArtifact,
			initialValue: store.initialValue,
		})

		const getState = () => get(store)

		// create the offset handlers we'll add to the store
		const handlers = offsetHandlers<_Data, _Input>({
			getState,
			getVariables: () => store.variables as _Input,
			artifact: this.paginationArtifact,
			fetch: async (args) => {
				return paginationStore.send({
					...args,
					session: await getSession(),
					variables: {
						...this.queryVariables(getState),
						...args?.variables,
					},
					cacheParams: {
						disableSubscriptions: true,
					},
				})
			},
			fetchUpdate: async (args) => {
				await initClient()
				return paginationStore.send({
					session: await getSession(),
					...args,
					variables: {
						...this.queryVariables(getState),
						...args?.variables,
					},
					cacheParams: {
						disableSubscriptions: true,
						applyUpdates: ['append'],
					},
				})
			},
			getSession,
			storeName: this.name,
		})

		const subscribe = (
			run: Subscriber<FragmentPaginatedResult<_Data>>,
			invalidate?: ((value?: FragmentPaginatedResult<_Data> | undefined) => void) | undefined
		): (() => void) => {
			const combined = derived([store, paginationStore], ([$parent, $pagination]) => {
				return {
					...$pagination,
					data: $parent,
				} as FragmentPaginatedResult<_Data>
			})

			return combined.subscribe(run, invalidate)
		}

		// add the offset handlers
		return {
			kind: CompiledFragmentKind,
			data: derived(paginationStore, ($value) => $value.data!),
			// @ts-expect-error
			subscribe,
			fetch: handlers.fetch,
			loadNextPage: handlers.loadNextPage,
			fetching: derived(paginationStore, ($store) => $store.fetching),
		}
	}
}

export type FragmentStorePaginated<_Data extends GraphQLObject, _Input> = Readable<{
	data: _Data
	fetching: boolean
	errors: GraphQLError[] | null
	pageInfo: PageInfo
}> & {
	fetch(params?: { policy?: CachePolicies }): Promise<void>
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
	errors: GraphQLError[] | null
} & _ExtraFields
