// externals
import { derived, get, readable, Readable, Writable, writable } from 'svelte/store'
// locals
import { deepEquals, FragmentStore, QueryResult, QueryStore, QueryStoreFetchParams } from '..'
import cache from '../cache'
import { ConfigFile, keyFieldsForType } from './config'
import { getHoudiniContext } from './context'
import { executeQuery } from './network'
import { GraphQLObject, HoudiniFetchContext, QueryArtifact } from './types'
import { getSession } from '../adapter'
import { fetchContext, QueryResultMap } from '../stores/query'

type RefetchFn<_Data = any, _Input = any> = (
	params?: QueryStoreFetchParams<_Input>
) => Promise<QueryResult<_Data, _Input>>

export function wrapPaginationStore<_Data, _Input>(
	store: QueryStore<_Data, _Input> | ReturnType<FragmentStore<_Data>['get']>
) {
	// @ts-ignore
	const { loadNextPage, loadPreviousPage, ...rest } = store

	// grab the current houdini context
	const context = getHoudiniContext()

	const result = rest
	if (loadNextPage) {
		// @ts-ignore
		result.loadNextPage = (...args) => loadNextPage(context, ...args)
	}
	if (loadPreviousPage) {
		// @ts-ignore
		result.loadPreviousPage = (...args) => loadPreviousPage(context, ...args)
	}

	return result
}

export function fragmentHandlers<_Data extends GraphQLObject, _Input>({
	config,
	paginationArtifact,
	initialValue,
	store,
}: {
	config: ConfigFile
	paginationArtifact: QueryArtifact
	initialValue: _Data | null
	store: Readable<GraphQLObject | null>
}) {
	const { targetType } = paginationArtifact.refetch || {}
	const typeConfig = config.types?.[targetType || '']
	if (!typeConfig) {
		throw new Error(
			`Missing type refetch configuration for ${targetType}. For more information, see https://www.houdinigraphql.com/guides/pagination#paginated-fragments`
		)
	}

	let queryVariables = () => ({} as _Input)
	// if the query is embedded we have to figure out the correct variables to pass
	if (paginationArtifact.refetch!.embedded) {
		// if we have a specific function to use when computing the variables
		if (typeConfig.resolve?.arguments) {
			queryVariables = () => {
				const value = get(store)
				return (typeConfig.resolve!.arguments?.(value) || {}) as _Input
			}
		} else {
			const keys = keyFieldsForType(config, targetType || '')
			queryVariables = () => {
				const value = get(store)
				// @ts-ignore
				return Object.fromEntries(keys.map((key) => [key, value[key]])) as _Input
			}
		}
	}

	return paginationHandlers<_Data, _Input>({
		config,
		// @ts-ignore
		stores: store as Readable<GraphQLObject>,
		artifact: paginationArtifact,
		queryVariables,
		refetch: async () => {
			return {} as any
		},
	})
}

export function queryHandlers<_Data extends GraphQLObject, _Input>({
	config,
	artifact,
	stores,
	fetch,
	queryVariables,
	storeName,
}: {
	config: ConfigFile
	artifact: QueryArtifact
	stores: QueryResultMap<_Data, _Input>
	fetch: QueryStore<_Data, _Input>['fetch']
	queryVariables: () => _Input | null
	pageInfo?: Readable<PageInfo>
	storeName: string
}) {
	// if there's no refetch config for the artifact there's a problem
	if (!artifact.refetch) {
		throw new Error('paginatedQuery must be passed a query with @paginate.')
	}

	// return the handlers
	return paginationHandlers<_Data, _Input>({
		artifact,
		stores,
		queryVariables,
		refetch: fetch,
		config,
		storeName,
	})
}

function paginationHandlers<_Data extends GraphQLObject, _Input>({
	artifact,
	stores,
	queryVariables,
	refetch,
	config,
	storeName,
}: {
	artifact: QueryArtifact
	stores: QueryResultMap<_Data, _Input>
	queryVariables: () => _Input | null
	documentLoading?: Readable<boolean>
	refetch: RefetchFn<_Data, _Input>
	config: ConfigFile
	pageInfo?: { [req_id: string]: Writable<PageInfo> }
	storeName: string
}): PaginatedHandlers<_Data, _Input> {
	// start with the defaults and no meaningful page info
	let loadPreviousPage: PaginatedHandlers<_Data, _Input>['loadPreviousPage'] = async (
		...args: Parameters<PaginatedHandlers<_Data, _Input>['loadPreviousPage']>
	) => {}
	let loadNextPage: PaginatedHandlers<_Data, _Input>['loadNextPage'] = async (
		...args: Parameters<PaginatedHandlers<_Data, _Input>['loadNextPage']>
	) => {}
	let pageInfo: { [req_id: string]: Writable<PageInfo> } = {}

	// loading state
	let paginationLoadingState = writable(false)

	let refetchQuery: RefetchFn<_Data, _Input>
	// if the artifact supports cursor based pagination
	if (artifact.refetch?.method === 'cursor') {
		// generate the cursor handlers
		const cursor = cursorHandlers<_Data, _Input>({
			artifact,
			stores,
			queryVariables,
			loading: paginationLoadingState,
			refetch,
			config,
			storeName,
		})
		// always track pageInfo
		pageInfo = cursor.pageInfo
		// always use the refetch fn
		refetchQuery = cursor.refetch

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
			refetch,
			stores,
			config,
			storeName,
			loading: paginationLoadingState,
		})

		loadNextPage = offset.loadPage
		refetchQuery = offset.refetch
	}

	// merge the pagination and document loading state
	const loading = derived([paginationLoadingState], ($loadingStates) => $loadingStates[0])

	return { loadNextPage, loadPreviousPage, pageInfo, loading, refetch: refetchQuery }
}

function cursorHandlers<_Data extends GraphQLObject, _Input>({
	config,
	artifact,
	stores,
	queryVariables: extraVariables,
	loading,
	refetch,
	storeName,
}: {
	config: ConfigFile
	artifact: QueryArtifact
	stores: QueryResultMap<_Data, _Input>
	queryVariables: () => _Input | null
	loading: Writable<boolean>
	refetch: RefetchFn
	storeName: string
}): PaginatedHandlers<_Data, _Input> {
	const pageInfo: { [req_id: string]: Writable<PageInfo> } = {}

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
		// @ts-ignore
		const { req_id } = houdiniContext.session()
		if (!pageInfo[req_id]) {
			pageInfo[req_id] = writable(nullPageInfo())
		}

		// set the loading state to true
		loading.set(true)

		// build up the variables to pass to the query
		const loadVariables: Record<string, any> = {
			...extraVariables?.(),
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
		pageInfo[req_id].set(extractPageInfo(result.data, resultPath))

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
		loadNextPage: async (houdiniContext: HoudiniFetchContext, pageCount?: number) => {
			// @ts-ignore
			const { req_id } = context.session()

			// we need to find the connection object holding the current page info
			const currentPageInfo = extractPageInfo(
				get(stores[req_id]).data,
				artifact.refetch!.path
			)

			// if there is no next page, we're done
			if (!currentPageInfo.hasNextPage) {
				return
			}

			// only specify the page count if we're given one
			const input: Record<string, any> = {
				after: currentPageInfo.endCursor,
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
		loadPreviousPage: async (houdiniContext: HoudiniFetchContext, pageCount?: number) => {
			// @ts-ignore
			const { req_id } = context.session()

			// we need to find the connection object holding the current page info
			const currentPageInfo = extractPageInfo(
				get(stores[req_id]).data,
				artifact.refetch!.path
			)

			// if there is no next page, we're done
			if (!currentPageInfo.hasPreviousPage) {
				return
			}

			// only specify the page count if we're given one
			const input: Record<string, any> = {
				before: currentPageInfo.startCursor,
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
		async refetch(args?: QueryStoreFetchParams<_Input>): Promise<QueryResult<_Data, _Input>> {
			// validate and prepare the request context for the current environment (client vs server)
			const { context, params } = fetchContext(artifact, storeName, args)
			// @ts-ignore
			const { req_id } = context.session

			const { variables } = params ?? {}

			// build up the variables to pass to the query
			const queryVariables: Record<string, any> = {
				...extraVariables(),
				...variables,
			}

			// if the input is different than the query variables then we just do everything like normal
			if (variables && !deepEquals(extraVariables(), variables)) {
				const result = await refetch(params)

				pageInfo[req_id].set(extractPageInfo(result, artifact.refetch!.path))
			}

			// we are updating the current set of items, count the number of items that currently exist
			// and ask for the full data set
			const count =
				countPage(artifact.refetch!.path.concat('edges'), get(stores[req_id]).data) ||
				artifact.refetch!.pageSize

			// if there are more records than the first page, we need fetch to load everything
			if (count && count > artifact.refetch!.pageSize) {
				// reverse cursors need the last entries in the list
				queryVariables[artifact.refetch!.update === 'prepend' ? 'last' : 'first'] = count
			}

			// set the loading state to true
			loading.set(true)

			// send the query
			const result = await refetch({
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

function offsetPaginationHandler<_Data extends GraphQLObject, _Input>({
	artifact,
	queryVariables: extraVariables,
	refetch,
	stores,
	config,
	loading,
	storeName,
}: {
	config: ConfigFile
	artifact: QueryArtifact
	queryVariables: () => _Input | null
	refetch: RefetchFn
	stores: QueryResultMap<_Data, _Input>
	loading: Writable<boolean>
	storeName: string
}): {
	loadPage: PaginatedHandlers<_Data, _Input>['loadNextPage']
	refetch: PaginatedHandlers<_Data, _Input>['refetch']
} {
	// we need to track the most recent offset for this handler
	let currentOffset = (ctx: HoudiniFetchContext) =>
		(artifact.refetch?.start as number) ||
		// @ts-ignore
		countPage(artifact.refetch!.path, get(stores[ctx.session()?.req_id])?.data) ||
		artifact.refetch!.pageSize

	return {
		loadPage: async (houdiniContext: HoudiniFetchContext, limit?: number) => {
			const offset = currentOffset(houdiniContext)

			// build up the variables to pass to the query
			const queryVariables: Record<string, any> = {
				...houdiniContext.variables(),
				...extraVariables(),
				offset,
			}
			if (limit) {
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
		async refetch(args?: QueryStoreFetchParams<_Input>): Promise<QueryResult<_Data, _Input>> {
			const { params, context } = fetchContext(artifact, storeName, args)
			const { variables } = params ?? {}

			// if the input is different than the query variables then we just do everything like normal
			if (variables && !deepEquals(extraVariables(), variables)) {
				return refetch(params)
			}

			// we are updating the current set of items, count the number of items that currently exist
			// and ask for the full data set
			// @ts-ignore
			const value = get(stores[context.session.req_id]).data
			const count = countPage(artifact.refetch!.path, value) || artifact.refetch!.pageSize

			// build up the variables to pass to the query
			const queryVariables: Record<string, any> = {
				...extraVariables(),
			}

			// if there are more records than the first page, we need fetch to load everything
			if (count > artifact.refetch!.pageSize) {
				queryVariables.limit = count
			}

			// set the loading state to true
			loading.set(true)

			// send the query
			const result = await refetch({
				...params,
				variables: queryVariables,
			})

			// we're not loading any more
			loading.set(false)

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
		houdiniContext: HoudiniFetchContext,
		pageCount?: number,
		after?: string | number
	): Promise<void>
	loadPreviousPage(
		houdiniContext: HoudiniFetchContext,
		pageCount?: number,
		before?: string
	): Promise<void>
	loading: Readable<boolean>
	pageInfo: { [req_id: string]: Writable<PageInfo> }
	refetch: RefetchFn<_Data, _Input>
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

export function extractPageInfo(data: GraphQLObject | null, path: string[]): PageInfo {
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
	if (value === null || data === null) {
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

export const nullPageInfo = () => ({
	startCursor: null,
	endCursor: null,
	hasNextPage: false,
	hasPreviousPage: false,
})
