// externals
import { derived, get, Readable, Writable, writable } from 'svelte/store'
// locals
import { deepEquals, FragmentStore, QueryResult, QueryStore, QueryStoreFetchParams } from '..'
import cache from '../cache'
import { ConfigFile, keyFieldsForType } from './config'
import { getHoudiniContext } from './context'
import { executeQuery } from './network'
import { GraphQLObject, HoudiniFetchContext, QueryArtifact } from './types'
import { fetchContext, QueryResultMap, sessionQueryStore } from '../stores/query'
import { currentReqID, sessionStore } from './session'

type FetchFn<_Data = any, _Input = any> = (
	params?: QueryStoreFetchParams<_Input>
) => Promise<QueryResult<_Data, _Input>>

export function wrapPaginationStore<_Data, _Input>(
	store: QueryStore<_Data, _Input> | ReturnType<FragmentStore<_Data>['get']>
) {
	// @ts-ignore
	const { loadNextPage, loadPreviousPage, paginationStrategy, subscribe, ...rest } = store

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
	config,
	paginationArtifact,
	stores,
	storeName,
}: {
	storeName: string
	config: ConfigFile
	paginationArtifact: QueryArtifact
	stores: { [reqID: string]: Readable<GraphQLObject | null> }
}) {
	const { targetType } = paginationArtifact.refetch || {}
	const typeConfig = config.types?.[targetType || '']
	if (!typeConfig) {
		throw new Error(
			`Missing type refetch configuration for ${targetType}. For more information, see https://www.houdinigraphql.com/guides/pagination#paginated-fragments`
		)
	}

	let queryVariables = (reqID: string) => ({} as _Input)
	// if the query is embedded we have to figure out the correct variables to pass
	if (paginationArtifact.refetch!.embedded) {
		// if we have a specific function to use when computing the variables
		if (typeConfig.resolve?.arguments) {
			queryVariables = (reqID: string) => {
				const value = get(stores[reqID])
				return (typeConfig.resolve!.arguments?.(value) || {}) as _Input
			}
		} else {
			const keys = keyFieldsForType(config, targetType || '')
			queryVariables = (reqID: string) => {
				const value = get(stores[reqID])
				// @ts-ignore
				return Object.fromEntries(keys.map((key) => [key, value[key]])) as _Input
			}
		}
	}

	return paginationHandlers<_Data, _Input>({
		storeName,
		config,
		stores,
		artifact: paginationArtifact,
		queryVariables,
		fetch: async () => {
			return {} as any
		},
		getValue: (reqID) => {
			return get(stores[reqID]) as _Data
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
	queryVariables: (reqID: string) => _Input | null
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
		fetch,
		config,
		storeName,
		getValue: (reqID: string) => get(stores[reqID])?.data || ({} as _Data),
	})
}

function paginationHandlers<_Data extends GraphQLObject, _Input>({
	artifact,
	stores,
	queryVariables,
	fetch,
	config,
	storeName,
	getValue,
}: {
	artifact: QueryArtifact
	stores: { [reqID: string]: any }
	getValue: (reqID: string) => _Data
	queryVariables: (reqID: string) => _Input | null
	documentLoading?: Readable<boolean>
	fetch: FetchFn<_Data, _Input>
	config: ConfigFile
	pageInfo?: { [reqID: string]: Writable<PageInfo> }
	storeName: string
}): PaginatedHandlers<_Data, _Input> {
	// start with the defaults and no meaningful page info
	let loadPreviousPage: PaginatedHandlers<_Data, _Input>['loadPreviousPage'] = async (
		...args: Parameters<PaginatedHandlers<_Data, _Input>['loadPreviousPage']>
	) => {}
	let loadNextPage: PaginatedHandlers<_Data, _Input>['loadNextPage'] = async (
		...args: Parameters<PaginatedHandlers<_Data, _Input>['loadNextPage']>
	) => {}
	let pageInfos: { [reqID: string]: Writable<PageInfo> } = {}

	// loading state
	let paginationLoadingState = writable(false)

	let onUnsubscribe = (reqID: string) => {}

	let fetchQuery: FetchFn<_Data, _Input>

	let paginationStrategy = artifact.refetch?.method

	// if the artifact supports cursor based pagination
	if (artifact.refetch?.method === 'cursor') {
		// generate the cursor handlers
		const cursor = cursorHandlers<_Data, _Input>({
			artifact,
			stores,
			queryVariables,
			loading: paginationLoadingState,
			fetch,
			config,
			storeName,
			getValue,
		})
		// always track pageInfo
		pageInfos = cursor.pageInfos
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
			stores,
			config,
			storeName,
			loading: paginationLoadingState,
			getValue,
		})

		loadNextPage = offset.loadPage
		fetchQuery = offset.fetch
	}

	// merge the pagination and document loading state
	const loading = derived([paginationLoadingState], ($loadingStates) => $loadingStates[0])

	return {
		loadNextPage,
		loadPreviousPage,
		pageInfos,
		loading,
		fetch: fetchQuery,
		onUnsubscribe,
		paginationStrategy,
	}
}

function cursorHandlers<_Data extends GraphQLObject, _Input>({
	config,
	artifact,
	stores,
	queryVariables: extraVariables,
	loading,
	fetch,
	storeName,
	getValue,
}: {
	config: ConfigFile
	artifact: QueryArtifact
	stores: { [reqID: string]: any }
	getValue: (reqID: string) => _Data
	queryVariables: (reqID: string) => _Input | null
	loading: Writable<boolean>
	fetch: FetchFn
	storeName: string
}) {
	const pageInfos: { [reqID: string]: Writable<PageInfo> } = {}

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
		// figure out the reqID for this session
		const reqID = currentReqID(houdiniContext, stores)
		// get the pageInfo store
		const pageInfo = pageInfoStore(houdiniContext, pageInfos)

		// set the loading state to true
		loading.set(true)

		// build up the variables to pass to the query
		const loadVariables: Record<string, any> = {
			...extraVariables?.(reqID),
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
		loadNextPage: async (houdiniContext: HoudiniFetchContext, pageCount?: number) => {
			// figure out the reqID for this session
			const reqID = currentReqID(houdiniContext, stores)

			// we need to find the connection object holding the current page info
			const currentPageInfo = extractPageInfo(getValue(reqID), artifact.refetch!.path)

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
			// figure out the reqID for this session
			const reqID = currentReqID(houdiniContext, stores)

			// we need to find the connection object holding the current page info
			const currentPageInfo = extractPageInfo(getValue(reqID), artifact.refetch!.path)

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
		pageInfos,
		async fetch(args?: QueryStoreFetchParams<_Input>): Promise<QueryResult<_Data, _Input>> {
			// validate and prepare the request context for the current environment (client vs server)
			const { context, params } = fetchContext(artifact, storeName, args)

			// get the session stores we will write to
			const reqID = currentReqID(context.session, stores)
			const pageInfo = sessionStore(context.session, pageInfos, nullPageInfo)
			const data = sessionQueryStore<_Data, _Input>(context.session, stores)

			const { variables } = params ?? {}

			// build up the variables to pass to the query
			const queryVariables: Record<string, any> = {
				...extraVariables(reqID),
				...variables,
			}

			// if the input is different than the query variables then we just do everything like normal
			if (variables && !deepEquals(extraVariables(reqID), variables)) {
				const result = await fetch(params)
				pageInfo.set(extractPageInfo(result, artifact.refetch!.path))
			}

			// we are updating the current set of items, count the number of items that currently exist
			// and ask for the full data set
			const count =
				countPage(artifact.refetch!.path.concat('edges'), get(data).data) ||
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
		onUnsubscribe(reqID: string) {
			if (pageInfos[reqID]) {
				delete pageInfos[reqID]
			}
		},
	}
}

function offsetPaginationHandler<_Data extends GraphQLObject, _Input>({
	artifact,
	queryVariables: extraVariables,
	fetch,
	stores,
	getValue,
	config,
	loading,
	storeName,
}: {
	config: ConfigFile
	artifact: QueryArtifact
	queryVariables: (reqID: string) => _Input | null
	fetch: FetchFn
	stores: { [reqID: string]: any }
	getValue: (reqID: string) => _Data
	loading: Writable<boolean>
	storeName: string
}): {
	loadPage: PaginatedHandlers<_Data, _Input>['loadNextPage']
	fetch: PaginatedHandlers<_Data, _Input>['fetch']
} {
	// we need to track the most recent offset for this handler
	let currentOffset = (ctx: HoudiniFetchContext) => {
		const store = sessionQueryStore<_Data, _Input>(ctx, stores)

		return (
			(artifact.refetch?.start as number) ||
			countPage(artifact.refetch!.path, get(store)?.data) ||
			artifact.refetch!.pageSize
		)
	}

	return {
		loadPage: async (houdiniContext: HoudiniFetchContext, limit?: number) => {
			const offset = currentOffset(houdiniContext)
			// figure out the reqID for this session
			const reqID = currentReqID(houdiniContext, stores)

			// build up the variables to pass to the query
			const queryVariables: Record<string, any> = {
				...houdiniContext.variables(),
				...extraVariables(reqID),
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
		async fetch(args?: QueryStoreFetchParams<_Input>): Promise<QueryResult<_Data, _Input>> {
			const { params, context } = fetchContext(artifact, storeName, args)

			const reqID = currentReqID(context.session, stores)
			// make sure we created a query store
			sessionQueryStore(context.session, stores)

			const { variables } = params ?? {}

			// if the input is different than the query variables then we just do everything like normal
			if (variables && !deepEquals(extraVariables(reqID), variables)) {
				return fetch(params)
			}

			// we are updating the current set of items, count the number of items that currently exist
			// and ask for the full data set
			const count =
				countPage(artifact.refetch!.path, getValue(reqID)) || artifact.refetch!.pageSize

			// build up the variables to pass to the query
			const queryVariables: Record<string, any> = {
				...extraVariables(reqID),
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
	pageInfos: { [reqID: string]: Writable<PageInfo> }
	fetch: FetchFn<_Data, _Input>
	onUnsubscribe: (reqID: string) => void
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

export const pageInfoStore = (
	session: { session: () => App.Session | null } | null | App.Session,
	home: {
		[key: string]: Writable<PageInfo>
	}
): Writable<PageInfo> => {
	return sessionStore(session, home, nullPageInfo)
}
