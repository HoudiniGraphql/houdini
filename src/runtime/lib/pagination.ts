import { derived, get, Readable, Writable, writable } from 'svelte/store'

import { deepEquals, FragmentStore, QueryResult, QueryStore, QueryStoreFetchParams } from '..'
import cache from '../cache'
import * as log from '../lib/log'
import { fetchParams } from '../stores/query'
import { ConfigFile, getCurrentConfig, keyFieldsForType } from './config'
import { executeQuery } from './network'
import { GraphQLObject, HoudiniFetchContext, QueryArtifact } from './types'

type FetchFn<_Data = any, _Input = any> = (
	params?: QueryStoreFetchParams<_Input>
) => Promise<QueryResult<_Data, _Input>>

export function wrapPaginationStore<_Data, _Input>(
	store: QueryStore<_Data, _Input> | ReturnType<FragmentStore<_Data>['get']>
) {
	// @ts-ignore
	const { paginationStrategy, subscribe, ...rest } = store

	// add the page info key if there is pagination
	const result = rest
	if (paginationStrategy === 'cursor') {
		// @ts-ignore
		result.pageInfo = derived([{ subscribe }], ([$store]) => {
			// @ts-ignore
			return $store.pageInfo
		})
	}

	return { subscribe, ...result }
}

export function fragmentHandlers<_Data extends GraphQLObject, _Input>({
	paginationArtifact,
	store,
	storeName,
	getContext,
}: {
	storeName: string
	paginationArtifact: QueryArtifact
	store: Readable<_Data | null>
	getContext: () => HoudiniFetchContext | null
}) {
	let queryVariables = async () => {
		const config = await getCurrentConfig()

		const { targetType } = paginationArtifact.refetch || {}
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
	// if the query is embedded we have to figure out the correct variables to pass
	if (paginationArtifact.refetch!.embedded) {
	}

	return paginationHandlers<_Data, _Input>({
		storeName,
		artifact: paginationArtifact,
		queryVariables,
		fetch: async () => {
			return {} as any
		},
		getValue: () => {
			return get(store) as _Data
		},
		getContext,
	})
}

export function queryHandlers<_Data extends GraphQLObject, _Input>({
	artifact,
	store,
	fetch,
	queryVariables,
	storeName,
	getContext,
}: {
	artifact: QueryArtifact
	store: Writable<QueryResult<_Data, _Input>>
	fetch: FetchFn<_Data, _Input>
	queryVariables: () => Promise<_Input | null>
	pageInfo?: Readable<PageInfo>
	storeName: string
	getContext: () => HoudiniFetchContext | null
}) {
	// if there's no refetch config for the artifact there's a problem
	if (!artifact.refetch) {
		throw new Error('paginatedQuery must be passed a query with @paginate.')
	}

	// return the handlers
	return paginationHandlers<_Data, _Input>({
		artifact,
		queryVariables,
		fetch,
		storeName,
		getValue: () => get(store)?.data ?? null,
		getContext,
	})
}

function paginationHandlers<_Data extends GraphQLObject, _Input>({
	artifact,
	queryVariables,
	fetch,
	storeName,
	getValue,
	getContext,
}: {
	artifact: QueryArtifact
	getValue: () => _Data | null
	queryVariables: () => Promise<_Input | null>
	documentLoading?: Readable<boolean>
	fetch: FetchFn<_Data, _Input>
	pageInfo?: Writable<PageInfo>
	storeName: string
	getContext: () => HoudiniFetchContext | null
}): PaginatedHandlers<_Data, _Input> {
	// start with the defaults and no meaningful page info
	let loadPreviousPage: PaginatedHandlers<_Data, _Input>['loadPreviousPage'] = async (
		...args: Parameters<PaginatedHandlers<_Data, _Input>['loadPreviousPage']>
	) => {}
	let loadNextPage: PaginatedHandlers<_Data, _Input>['loadNextPage'] = async (
		...args: Parameters<PaginatedHandlers<_Data, _Input>['loadNextPage']>
	) => {}
	const extra: Record<string, any> = {}

	// loading state
	let paginationLoadingState = writable(false)

	let onUnsubscribe = () => {}

	let fetchQuery: FetchFn<_Data, _Input>

	let paginationStrategy = artifact.refetch?.method

	// if the artifact supports cursor based pagination
	if (artifact.refetch?.method === 'cursor') {
		// generate the cursor handlers
		const cursor = cursorHandlers<_Data, _Input>({
			artifact,
			queryVariables,
			loading: paginationLoadingState,
			fetch,
			storeName,
			getValue,
			getContext,
		})
		// always track pageInfo
		extra.pageInfo = cursor.pageInfo
		// always use the refetch fn
		fetchQuery = cursor.fetch
		onUnsubscribe = cursor.onUnsubscribe

		// if we are implementing forward pagination
		if (artifact.refetch.update === 'append') {
			loadNextPage = cursor.loadNextPage
		}
		// the artifact implements backwards pagination
		else {
			loadPreviousPage = cursor.loadPreviousPage
		}
	}
	// the artifact supports offset-based pagination, only loadNextPage is valid
	else {
		const offset = offsetPaginationHandler<_Data, _Input>({
			artifact,
			queryVariables,
			fetch,
			storeName,
			loading: paginationLoadingState,
			getValue,
			getContext,
		})

		loadNextPage = offset.loadPage
		fetchQuery = offset.fetch
	}

	// merge the pagination and document loading state
	const loading = derived([paginationLoadingState], ($loadingStates) => $loadingStates[0])

	return {
		loadNextPage,
		loadPreviousPage,
		loading,
		fetch: fetchQuery,
		onUnsubscribe,
		paginationStrategy,
		...extra,
	}
}

function cursorHandlers<_Data extends GraphQLObject, _Input>({
	artifact,
	queryVariables: extraVariables,
	loading,
	fetch,
	storeName,
	getValue,
	getContext,
}: {
	artifact: QueryArtifact
	getValue: () => _Data | null
	queryVariables: () => Promise<_Input | null>
	loading: Writable<boolean>
	fetch: FetchFn
	storeName: string
	getContext: () => HoudiniFetchContext | null
}) {
	const pageInfo = writable<PageInfo | null>(null)

	// dry up the page-loading logic
	const loadPage = async ({
		houdiniContext,
		pageSizeVar,
		input,
		functionName,
	}: {
		houdiniContext: HoudiniFetchContext
		pageSizeVar: string
		functionName: string
		input: {}
	}) => {
		const config = await getCurrentConfig()

		// set the loading state to true
		loading.set(true)

		// build up the variables to pass to the query
		const loadVariables: Record<string, any> = {
			...(await extraVariables?.()),
			...houdiniContext.variables(),
			...input,
		}

		// if we don't have a value for the page size, tell the user
		if (!loadVariables[pageSizeVar] && !artifact.refetch!.pageSize) {
			throw missingPageSizeError(functionName)
		}

		// send the query
		const { result } = await executeQuery<GraphQLObject, {}>({
			artifact,
			variables: loadVariables,
			session: houdiniContext.session?.(),
			cached: false,
			config,
		})

		// if the query is embedded in a node field (paginated fragments)
		// make sure we look down one more for the updated page info
		const resultPath = [...artifact.refetch!.path]
		if (artifact.refetch!.embedded) {
			const { targetType } = artifact.refetch!
			// make sure we have a type config for the pagination target type
			if (!config.types?.[targetType]?.resolve) {
				throw new Error(
					`Missing type resolve configuration for ${targetType}. For more information, see https://www.houdinigraphql.com/guides/pagination#paginated-fragments`
				)
			}

			// make sure that we pull the value out of the correct query field
			resultPath.unshift(config.types[targetType].resolve!.queryField)
		}

		// we need to find the connection object holding the current page info
		pageInfo.set(extractPageInfo(result.data, resultPath))

		// update cache with the result
		cache.write({
			selection: artifact.selection,
			data: result.data,
			variables: loadVariables,
			applyUpdates: true,
		})

		// we're not loading any more
		loading.set(false)
	}

	return {
		loading,
		loadNextPage: async (pageCount?: number, after?: string, ctx?: HoudiniFetchContext) => {
			const houdiniContext = getContext() ?? ctx
			if (!houdiniContext) {
				throw contextError
			}
			// we need to find the connection object holding the current page info
			const currentPageInfo = extractPageInfo(getValue(), artifact.refetch!.path)

			// if there is no next page, we're done
			if (!currentPageInfo.hasNextPage) {
				return
			}

			// only specify the page count if we're given one
			const input: Record<string, any> = {
				after: after ?? currentPageInfo.endCursor,
			}
			if (pageCount) {
				input.first = pageCount
			}

			// load the page
			return await loadPage({
				houdiniContext,
				pageSizeVar: 'first',
				functionName: 'loadNextPage',
				input,
			})
		},
		loadPreviousPage: async (
			pageCount?: number,
			before?: string,
			ctx?: HoudiniFetchContext
		) => {
			const houdiniContext = getContext() ?? ctx
			if (!houdiniContext) {
				throw contextError
			}
			// we need to find the connection object holding the current page info
			const currentPageInfo = extractPageInfo(getValue(), artifact.refetch!.path)

			// if there is no next page, we're done
			if (!currentPageInfo.hasPreviousPage) {
				return
			}

			// only specify the page count if we're given one
			const input: Record<string, any> = {
				before: before ?? currentPageInfo.startCursor,
			}
			if (pageCount) {
				input.last = pageCount
			}

			// load the page
			return await loadPage({
				houdiniContext,
				pageSizeVar: 'last',
				functionName: 'loadPreviousPage',
				input,
			})
		},
		pageInfo,
		async fetch(args?: QueryStoreFetchParams<_Input>): Promise<QueryResult<_Data, _Input>> {
			// validate and prepare the request context for the current environment (client vs server)
			const { params } = fetchParams(getContext(), artifact, storeName, args)

			const { variables } = params ?? {}

			// build up the variables to pass to the query
			const extra = await extraVariables()
			const queryVariables: Record<string, any> = {
				...extra,
				...variables,
			}

			// if the input is different than the query variables then we just do everything like normal
			if (variables && !deepEquals(extra, variables)) {
				const result = await fetch(params)
				pageInfo.set(extractPageInfo(result, artifact.refetch!.path))
			}

			// we are updating the current set of items, count the number of items that currently exist
			// and ask for the full data set
			const count =
				countPage(artifact.refetch!.path.concat('edges'), getValue()) ||
				artifact.refetch!.pageSize

			// if there are more records than the first page, we need fetch to load everything
			if (count && count > artifact.refetch!.pageSize) {
				// reverse cursors need the last entries in the list
				queryVariables[artifact.refetch!.update === 'prepend' ? 'last' : 'first'] = count
			}

			// set the loading state to true
			loading.set(true)

			// send the query
			const result = await fetch({
				...params,
				variables: queryVariables,
			})

			// keep the page info store up to date
			pageInfo.set(extractPageInfo(result.data, artifact.refetch!.path))

			// we're not loading any more
			loading.set(false)

			return {
				data: result.data,
				variables: queryVariables as _Input,
				isFetching: false,
				partial: result.partial,
				errors: null,
				source: result.source,
			}
		},
		onUnsubscribe() {},
	}
}

function offsetPaginationHandler<_Data extends GraphQLObject, _Input>({
	artifact,
	queryVariables: extraVariables,
	fetch,
	getValue,
	loading,
	storeName,
	getContext,
}: {
	artifact: QueryArtifact
	queryVariables: () => Promise<_Input | null>
	fetch: FetchFn
	getValue: () => _Data | null
	loading: Writable<boolean>
	storeName: string
	getContext: () => HoudiniFetchContext | null
}): {
	loadPage: PaginatedHandlers<_Data, _Input>['loadNextPage']
	fetch: PaginatedHandlers<_Data, _Input>['fetch']
} {
	// we need to track the most recent offset for this handler
	let currentOffset = (ctx: HoudiniFetchContext) => {
		return (
			(artifact.refetch?.start as number) ||
			countPage(artifact.refetch!.path, getValue()) ||
			artifact.refetch!.pageSize
		)
	}

	return {
		loadPage: async (limit?: number, offset?: number, ctx?: HoudiniFetchContext) => {
			const config = await getCurrentConfig()

			const houdiniContext = getContext() ?? ctx
			if (!houdiniContext) {
				throw contextError
			}

			offset ??= currentOffset(houdiniContext)

			// build up the variables to pass to the query
			const queryVariables: Record<string, any> = {
				...houdiniContext.variables(),
				...(await extraVariables()),
				offset,
			}
			if (limit || limit === 0) {
				queryVariables.limit = limit
			}

			// if we made it this far without a limit argument and there's no default page size,
			// they made a mistake
			if (!queryVariables.limit && !artifact.refetch!.pageSize) {
				throw missingPageSizeError('loadNextPage')
			}

			// set the loading state to true
			loading.set(true)

			// send the query
			const { result } = await executeQuery<GraphQLObject, {}>({
				artifact,
				variables: queryVariables,
				session: houdiniContext.session?.(),
				cached: false,
				config,
			})

			// update cache with the result
			cache.write({
				selection: artifact.selection,
				data: result.data,
				variables: queryVariables,
				applyUpdates: true,
			})

			// add the page size to the offset so we load the next page next time
			const pageSize = queryVariables.limit || artifact.refetch!.pageSize
			currentOffset += pageSize

			// we're not loading any more
			loading.set(false)
		},
		async fetch(args?: QueryStoreFetchParams<_Input>): Promise<QueryResult<_Data, _Input>> {
			const { params } = fetchParams(getContext(), artifact, storeName, args)

			const { variables } = params ?? {}

			const extra = await extraVariables()

			// if the input is different than the query variables then we just do everything like normal
			if (variables && !deepEquals(extra, variables)) {
				return fetch(params)
			}

			// we are updating the current set of items, count the number of items that currently exist
			// and ask for the full data set
			const count =
				countPage(artifact.refetch!.path, getValue()) || artifact.refetch!.pageSize

			// build up the variables to pass to the query
			const queryVariables: Record<string, any> = {
				...extra,
			}

			// if there are more records than the first page, we need fetch to load everything
			if (count > artifact.refetch!.pageSize) {
				queryVariables.limit = count
			}

			// set the loading state to true
			loading.set(true)

			// send the query
			const result = await fetch({
				...params,
				variables: queryVariables,
			})

			// we're not loading any more
			loading.set(false)

			return {
				data: result.data,
				variables: queryVariables as _Input,
				isFetching: false,
				partial: result.partial,
				errors: null,
				source: result.source,
			}
		},
	}
}
export type PaginatedDocumentHandlers<_Data, _Input> = {
	loadNextPage(pageCount?: number, after?: string | number): Promise<void>
	loadPreviousPage(pageCount?: number, before?: string): Promise<void>
	loading: Readable<boolean>
	pageInfo: Readable<PageInfo>
	refetch: (vars?: _Input) => Promise<_Data>
}

export type PaginatedHandlers<_Data, _Input> = {
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
	loading: Readable<boolean>
	pageInfo?: Writable<PageInfo>
	fetch: FetchFn<_Data, _Input>
	onUnsubscribe: () => void
	paginationStrategy?: 'cursor' | 'offset'
}

function missingPageSizeError(fnName: string) {
	return
}

export type PageInfo = {
	startCursor: string | null
	endCursor: string | null
	hasNextPage: boolean
	hasPreviousPage: boolean
}

export function extractPageInfo(data: any, path: string[]): PageInfo {
	if (!data) {
		return {
			startCursor: null,
			endCursor: null,
			hasNextPage: false,
			hasPreviousPage: false,
		}
	}

	let localPath = [...path]
	// walk down the object until we get to the end
	let current = data
	while (localPath.length > 0) {
		if (!current) {
			break
		}
		current = current[localPath.shift() as string] as GraphQLObject
	}

	return (current?.pageInfo as PageInfo) ?? nullPageInfo()
}

export function countPage<_Data extends GraphQLObject>(
	source: string[],
	value: _Data | null
): number {
	let data = value
	if (value === null || data === null || data === undefined) {
		return 0
	}

	for (const field of source) {
		const obj = data[field] as _Data | _Data[]
		if (obj && !Array.isArray(obj)) {
			data = obj
		} else if (!data) {
			throw new Error('Could not count page size')
		}

		if (Array.isArray(obj)) {
			return obj.length
		}
	}

	return 0
}

const nullPageInfo = (): PageInfo => ({
	startCursor: null,
	endCursor: null,
	hasNextPage: false,
	hasPreviousPage: false,
})

const contextError = `${log.red('⚠️ Could not find houdini context for a pagination method ⚠️')}
This really shouldn't happen. Please open a ticket describing your situation. 

In the meantime, you will need to do something like the following. Make sure getHoudiniContext is 
called at the top of your component (outside any event handlers or function definitions) and then 
passed to the method:

<script lang="ts">
    const ${log.yellow('context')} = getHoudiniContext();

    const onClick = () => GQL_${log.cyan('[YOUR_STORE]')}.loadNextPage(null, null, ${log.yellow(
	'context'
)});
</script>`
