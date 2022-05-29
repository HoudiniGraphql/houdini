// externals
import { derived, get, readable, Readable, Writable, writable } from 'svelte/store'
// locals
import cache from './cache'
import { fragment } from './fragment'
import { executeQuery } from './network'
import { query, QueryResponse } from './query'
import { Fragment, GraphQLObject, GraphQLTagResult, Operation, QueryArtifact } from './types'
// this has to be in a separate file since config isn't defined in cache/index.ts
import { HoudiniContextEvent, QueryStore } from '.'
import { ConfigFile, keyFieldsForType } from './config'
import { countPage, extractPageInfo, PageInfo } from './utils'

//Todo: houdiniContext Type
type RefetchFn<_Data = any, _Input = any> = (
	houdiniContext: HoudiniContextEvent,
	vars: _Input
) => Promise<_Data>

export function paginatedQuery<_Query extends Operation<any, any>>(
	document: GraphQLTagResult
): QueryResponse<_Query['result'], _Query['input']> & PaginatedHandlers<_Query['input']> {
	// TODO: fix type checking paginated
	// @ts-ignore: the query store will only include the methods when it needs to
	// and the userland type checking happens as part of the query type generation
	return query(document)
}

export function paginatedFragment<_Fragment extends Fragment<any>>(
	document: GraphQLTagResult,
	initialValue: _Fragment
): { data: Readable<_Fragment['shape']> } & PaginatedHandlers<any> {
	// make sure we got a query document
	if (document.kind !== 'HoudiniFragment') {
		throw new Error('paginatedFragment() must be passed a fragment document')
	}
	// if we don't have a pagination fragment there is a problem
	if (!document.artifact.refetch?.paginated) {
		throw new Error('paginatedFragment must be passed a fragment with @paginate')
	}

	// TODO: fix type checking paginated
	// @ts-ignore: the query store will only include the methods when it needs to
	// and the userland type checking happens as part of the query type generation
	return fragment(document, initialValue)
}

export function fragmentHandlers({
	config,
	paginationArtifact,
	initialValue,
	store,
}: {
	config: ConfigFile
	paginationArtifact: QueryArtifact
	initialValue: {}
	store: Readable<GraphQLObject>
}) {
	const partial = writable(false)

	const { targetType } = paginationArtifact.refetch || {}
	const typeConfig = config.types?.[targetType || '']
	if (!typeConfig) {
		throw new Error(
			`Missing type refetch configuration for ${targetType}. For more information, see https://www.houdinigraphql.com/guides/pagination#paginated-fragments`
		)
	}

	let queryVariables = () => ({})
	// if the query is embedded we have to figure out the correct variables to pass
	if (paginationArtifact.refetch!.embedded) {
		// if we have a specific function to use when computing the variables
		if (typeConfig.resolve?.arguments) {
			queryVariables = () => typeConfig.resolve!.arguments?.(initialValue) || {}
		} else {
			const keys = keyFieldsForType(config, targetType || '')
			// @ts-ignore
			queryVariables = () => Object.fromEntries(keys.map((key) => [key, initialValue[key]]))
		}
	}

	return paginationHandlers({
		config,
		setPartial: partial.set,
		initialValue,
		store,
		artifact: paginationArtifact,
		queryVariables,
	})
}

export function queryHandlers({
	config,
	artifact,
	store,
	queryVariables,
}: {
	config: ConfigFile
	artifact: QueryArtifact
	store: QueryStore<any, any>
	queryVariables: () => GraphQLObject
}) {
	// if there's no refetch config for the artifact there's a problem
	if (!artifact.refetch) {
		throw new Error('paginatedQuery must be passed a query with @paginate.')
	}

	// create some derived stores from the query meta data
	const loading = derived([store], ([$store]) => $store.isFetching)
	const data = derived([store], ([$store]) => $store.data)

	// return the handlers
	return paginationHandlers({
		documentLoading: loading,
		initialValue: get(store).data || {},
		artifact,
		store: data,
		queryVariables,
		refetch: store.query,
		setPartial: store.setPartial,
		config,
	})
}

export function paginationHandlers<_Query extends Operation<any, any>>({
	initialValue,
	artifact,
	store,
	queryVariables,
	documentLoading,
	refetch,
	setPartial,
	config,
}: {
	initialValue: GraphQLObject
	artifact: QueryArtifact
	store: Readable<GraphQLObject>
	queryVariables?: () => {}
	documentLoading?: Readable<boolean>
	refetch?: RefetchFn<_Query['result'], _Query['input']>
	setPartial: (val: boolean) => void
	config: ConfigFile
}): PaginatedHandlers<_Query['input']> {
	// start with the defaults and no meaningful page info
	let loadPreviousPage: PaginatedHandlers<_Query>['loadPreviousPage'] = async (
		...args: Parameters<PaginatedHandlers<_Query>['loadPreviousPage']>
	) => {}
	let loadNextPage: PaginatedHandlers<_Query>['loadNextPage'] = async (
		...args: Parameters<PaginatedHandlers<_Query>['loadNextPage']>
	) => {}
	let pageInfo = readable<PageInfo>(
		{
			startCursor: null,
			endCursor: null,
			hasNextPage: false,
			hasPreviousPage: false,
		},
		() => {}
	)

	// loading state
	let paginationLoadingState = writable(false)

	let refetchQuery: RefetchFn<_Query['result'], _Query['input']>
	// if the artifact supports cursor based pagination
	if (artifact.refetch?.method === 'cursor') {
		// generate the cursor handlers
		const cursor = cursorHandlers({
			initialValue,
			artifact,
			store,
			queryVariables,
			loading: paginationLoadingState,
			refetch,
			setPartial,
			config,
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
		const offset = offsetPaginationHandler({
			initialValue,
			artifact,
			queryVariables,
			loading: paginationLoadingState,
			refetch,
			store,
			setPartial,
		})

		loadNextPage = offset.loadPage
		refetchQuery = offset.refetch
	}

	// if no loading state was provided just use a store that's always false
	if (!documentLoading) {
		documentLoading = readable(false, () => {})
	}

	// merge the pagination and document loading state
	const loading = derived(
		[paginationLoadingState, documentLoading],
		($loadingStates) => $loadingStates[0] || $loadingStates[1]
	)

	return { loadNextPage, loadPreviousPage, pageInfo, loading, refetch: refetchQuery }
}

function cursorHandlers<_Query extends Operation<any, any>>({
	config,
	initialValue,
	artifact,
	store,
	queryVariables: extraVariables,
	loading,
	refetch,
	setPartial,
}: {
	config: ConfigFile
	initialValue: GraphQLObject
	artifact: QueryArtifact
	store: Readable<GraphQLObject>
	queryVariables?: () => {}
	loading: Writable<boolean>
	refetch?: RefetchFn
	setPartial: (val: boolean) => void
}): PaginatedHandlers<_Query> {
	// track the current page info in an easy-to-reach store
	const initialPageInfo = extractPageInfo(initialValue, artifact.refetch!.path) ?? {
		startCursor: null,
		endCursor: null,
		hasNextPage: false,
		hasPreviousPage: false,
	}

	const pageInfo = writable<PageInfo>(initialPageInfo)

	// hold onto the current value
	let value = initialValue
	store.subscribe((val) => {
		pageInfo.set(extractPageInfo(val, artifact.refetch!.path))
		value = val
	})

	// dry up the page-loading logic
	const loadPage = async ({
		houdiniContext,
		pageSizeVar,
		input,
		functionName,
	}: {
		houdiniContext: HoudiniContextEvent
		pageSizeVar: string
		functionName: string
		input: {}
	}) => {
		// set the loading state to true
		loading.set(true)

		// build up the variables to pass to the query
		const queryVariables: Record<string, any> = {
			...extraVariables,
			...houdiniContext.variables(),
			...input,
		}

		// if we don't have a value for the page size, tell the user
		if (!queryVariables[pageSizeVar] && !artifact.refetch!.pageSize) {
			throw missingPageSizeError(functionName)
		}

		// send the query
		const { result, partial: partialData } = await executeQuery<GraphQLObject, {}>(
			artifact,
			queryVariables,
			houdiniContext.session,
			false
		)

		setPartial(partialData)

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
			variables: queryVariables,
			applyUpdates: true,
		})

		// we're not loading any more
		loading.set(false)
	}

	return {
		loading,
		loadNextPage: async (houdiniContext: HoudiniContextEvent, pageCount?: number) => {
			// we need to find the connection object holding the current page info
			const currentPageInfo = extractPageInfo(value, artifact.refetch!.path)

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
		loadPreviousPage: async (houdiniContext: HoudiniContextEvent, pageCount?: number) => {
			// we need to find the connection object holding the current page info
			const currentPageInfo = extractPageInfo(value, artifact.refetch!.path)

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
		pageInfo: { subscribe: pageInfo.subscribe },
		async refetch(houdiniContext: HoudiniContextEvent, input: any) {
			// if this document shouldn't be refetched, don't do anything
			if (!refetch) {
				return
			}
			// if the input is different than the query variables then we just do everything like normal
			if (input && JSON.stringify(houdiniContext.variables()) !== JSON.stringify(input)) {
				return refetch(houdiniContext, input)
			}

			// we are updating the current set of items, count the number of items that currently exist
			// and ask for the full data set
			const count =
				countPage(artifact.refetch!.path.concat('edges'), value) ||
				artifact.refetch!.pageSize

			// build up the variables to pass to the query
			const queryVariables: Record<string, any> = {
				...houdiniContext.variables(),
				...extraVariables,
				// reverse cursors need the last entries in the list
				[artifact.refetch!.update === 'prepend' ? 'last' : 'first']: count,
			}

			// set the loading state to true
			loading.set(true)

			// send the query
			const { result, partial: partialData } = await executeQuery<GraphQLObject, {}>(
				artifact,
				queryVariables,
				houdiniContext.session,
				false
			)
			setPartial(partialData)

			// update cache with the result
			cache.write({
				selection: artifact.selection,
				data: result.data,
				variables: queryVariables,
				// overwrite the current data
				applyUpdates: false,
			})

			// we're not loading any more
			loading.set(false)
		},
	}
}

function offsetPaginationHandler<_Query extends Operation<any, any>>({
	artifact,
	queryVariables: extraVariables,
	loading,
	refetch,
	initialValue,
	store,
	setPartial,
}: {
	artifact: QueryArtifact
	queryVariables?: {}
	loading: Writable<boolean>
	refetch?: RefetchFn
	initialValue: GraphQLObject
	store: Readable<GraphQLObject>
	setPartial: (val: boolean) => void
}): {
	loadPage: PaginatedHandlers<_Query>['loadNextPage']
	refetch: PaginatedHandlers<_Query>['refetch']
} {
	// we need to track the most recent offset for this handler
	let currentOffset = (artifact.refetch?.start as number) || 0

	// hold onto the current value
	let value = initialValue
	store.subscribe((val) => {
		value = val
	})

	return {
		// Todo: houdiniContext Type
		loadPage: async (houdiniContext: HoudiniContextEvent, limit?: number) => {
			// build up the variables to pass to the query
			const queryVariables: Record<string, any> = {
				...houdiniContext.variables(),
				...extraVariables,
				offset: currentOffset,
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
			const { result, partial: partialData } = await executeQuery<GraphQLObject, {}>(
				artifact,
				queryVariables,
				houdiniContext.session,
				false
			)
			setPartial(partialData)

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
		async refetch(houdiniContext: HoudiniContextEvent, input: any) {
			// if this document shouldn't be refetched, don't do anything
			if (!refetch) {
				return
			}
			// if the input is different than the query variables then we just do everything like normal
			if (input && JSON.stringify(houdiniContext.variables()) !== JSON.stringify(input)) {
				return refetch(houdiniContext, input)
			}

			// we are updating the current set of items, count the number of items that currently exist
			// and ask for the full data set
			const count = countPage(artifact.refetch!.path, value)

			// build up the variables to pass to the query
			const queryVariables: Record<string, any> = {
				...houdiniContext.variables(),
				...extraVariables,
				limit: count,
			}

			// set the loading state to true
			loading.set(true)

			// send the query
			const { result, partial: partialData } = await executeQuery<GraphQLObject, {}>(
				artifact,
				queryVariables,
				houdiniContext.session,
				false
			)

			setPartial(partialData)

			// update cache with the result
			cache.write({
				selection: artifact.selection,
				data: result.data,
				variables: queryVariables,
				applyUpdates: true,
			})

			// we're not loading any more
			loading.set(false)
		},
	}
}

type PaginatedHandlers<_Query extends Operation<any, any>> = {
	// TODO: houdiniContext Type (houdiniContext: HoudiniContextEvent)
	loadNextPage(
		houdiniContext: HoudiniContextEvent,
		pageCount?: number,
		after?: string | number
	): Promise<void>
	loadPreviousPage(
		houdiniContext: HoudiniContextEvent,
		pageCount?: number,
		before?: string
	): Promise<void>
	loading: Readable<boolean>
	pageInfo: Readable<PageInfo>
	refetch: RefetchFn<_Query['result'], _Query['input']>
}

function missingPageSizeError(fnName: string) {
	return
}
