import cache from '$houdini/runtime/cache'
import type { DocumentStore } from '$houdini/runtime/client'
import { getCurrentConfig, keyFieldsForType } from '$houdini/runtime/lib/config'
import { siteURL } from '$houdini/runtime/lib/constants'
import { extractPageInfo } from '$houdini/runtime/lib/pageInfo'
import { cursorHandlers, offsetHandlers } from '$houdini/runtime/lib/pagination'
import { marshalInputs } from '$houdini/runtime/lib/scalars'
import type {
	GraphQLObject,
	FragmentArtifact,
	HoudiniFetchContext,
	GraphQLVariables,
	QueryArtifact,
	PageInfo,
	CursorHandlers,
} from '$houdini/runtime/lib/types'
import { CompiledFragmentKind, fragmentKey } from '$houdini/runtime/lib/types'
import { get, derived } from 'svelte/store'
import type { Readable, Subscriber } from 'svelte/store'

import { isBrowser } from '../adapter'
import { getClient } from '../client'
import { getSession } from '../session'
import type { FragmentStoreInstance, OffsetFragmentStoreInstance } from '../types'
import { BaseStore } from './base'
import type { StoreConfig } from './query'

// a fragment store exists in multiple places in a given application so we
// can't just return a store directly, the user has to load the version of the
// fragment store for the object the store has been mixed into
export class FragmentStore<
	_Data extends GraphQLObject,
	_ReferenceType extends {},
	_Input extends GraphQLVariables = GraphQLVariables
> {
	artifact: FragmentArtifact
	name: string
	kind = CompiledFragmentKind

	protected context: HoudiniFetchContext | null = null

	constructor({ artifact, storeName }: { artifact: FragmentArtifact; storeName: string }) {
		this.artifact = artifact
		this.name = storeName
	}

	get(
		initialValue: _Data | { [fragmentKey]: _ReferenceType } | null
	): FragmentStoreInstance<_Data | null, _Input> & { initialValue: _Data | null } {
		const { variables, parent } =
			// @ts-expect-error: typescript can't guarantee that the fragment key is defined
			// but if its not, then the fragment wasn't mixed into the right thing
			// the variables for the fragment live on the initial value's $fragment key
			initialValue?.[fragmentKey]?.values?.[this.artifact.name] ?? {}
		// @ts-expect-error: see above.
		const { loading } = initialValue?.[fragmentKey] ?? {}
		if (
			!loading &&
			initialValue &&
			fragmentKey in initialValue &&
			(!variables || !parent) &&
			isBrowser
		) {
			console.warn(
				`⚠️ Parent does not contain the information for this fragment. Something is wrong.
Please ensure that you have passed a record that has ${this.artifact.name} mixed into it.`
			)
		}

		// if we got this far then we are safe to use the fields on the object
		let data = initialValue as _Data | null

		// on the client, we want to ensure that we apply masking to the initial value by
		// loading the value from cache
		if (loading || (initialValue && parent && isBrowser)) {
			data = cache.read({
				selection: this.artifact.selection,
				parent,
				variables,
				loading,
			}).data as _Data
		}

		// build up a document store that we will use to subscribe the fragment to cache updates
		const store = new BaseStore<_Data, _Input>({
			artifact: this.artifact,
			initialValue: data,
		})
		if (!loading && parent) {
			store.observer.send({ variables, setup: true, stuff: { parentID: parent } })
		}

		return {
			initialValue: data,
			variables: marshalInputs({
				artifact: this.artifact,
				input: variables,
				config: getCurrentConfig(),
				rootType: this.artifact.rootType,
			}) as _Input,
			kind: CompiledFragmentKind,
			subscribe: derived([store], ([$store]) => $store.data).subscribe,
		}
	}
}

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
		let idVariables = {}
		const value = getState()
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
	_Input extends GraphQLVariables
> extends BasePaginatedFragmentStore<_Data, _Input> {
	// we want to add the cursor-based fetch to the return value of get
	get(initialValue: _Data | null) {
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

		const handlers = this.storeHandlers(
			paginationStore,
			initialValue,
			() => get(store),
			// the variables that are needed for this query are the store's values and the ids
			() => store.variables as NonNullable<_Input>
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
				return {
					...$pagination,
					data: $parent,
					pageInfo: extractPageInfo($parent, this.paginationArtifact.refetch!.path),
				} as FragmentPaginatedResult<_Data, { pageInfo: PageInfo }>
			})

			return combined.subscribe(run, invalidate)
		}

		return {
			kind: CompiledFragmentKind,
			subscribe: subscribe,
			fetch: handlers.fetch,

			// add the pagination handlers
			loadNextPage: handlers.loadNextPage,
			loadPreviousPage: handlers.loadPreviousPage,
		}
	}

	protected storeHandlers(
		observer: DocumentStore<_Data, _Input>,
		initialValue: _Data | null,
		getState: () => _Data | null,
		getVariables: () => NonNullable<_Input>
	): CursorHandlers<_Data, _Input> {
		return cursorHandlers<_Data, _Input>({
			getState,
			getVariables,
			artifact: this.paginationArtifact,
			fetchUpdate: async (args, updates) => {
				return observer.send({
					session: await getSession(),
					...args,
					variables: {
						...args?.variables,
						...this.queryVariables(getState),
					},
					cacheParams: {
						applyUpdates: updates,
						disableSubscriptions: true,
					},
				})
			},
			fetch: async (args) => {
				return await observer.send({
					session: await getSession(),
					...args,
					variables: {
						...args?.variables,
						...this.queryVariables(getState),
					},
					cacheParams: {
						disableSubscriptions: true,
					},
				})
			},
			getSession,
		})
	}
}

export class FragmentStoreOffset<
	_Data extends GraphQLObject,
	_Input extends GraphQLVariables
> extends BasePaginatedFragmentStore<_Data, _Input> {
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
			// @ts-ignore
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
