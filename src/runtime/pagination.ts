// externals
import { derived, readable, Readable, Writable, writable } from 'svelte/store'
// locals
import {
	Operation,
	GraphQLTagResult,
	Fragment,
	GraphQLObject,
	QueryArtifact,
	FragmentArtifact,
} from './types'
import { query, QueryResponse } from './query'
import { fragment } from './fragment'
import { getVariables } from './context'
import { executeQuery, QueryInputs } from './network'
import cache from './cache'
// @ts-ignore: this file will get generated and does not exist in the source code
import { getSession } from './adapter.mjs.js'
// this has to be in a separate file since config isn't defined in cache/index.ts
import { countPage, extractPageInfo, PageInfo } from './utils'
import { ConfigFile, keyFieldsForType } from './config'

type RefetchFn = (vars: any) => Promise<void>

export function paginatedQuery<_Query extends Operation<any, any>>(
	document: GraphQLTagResult
): QueryResponse<_Query['result'], _Query['input']> & PaginatedHandlers<_Query['input']> {
	// make sure we got a query document
	if (document.kind !== 'HoudiniQuery') {
		throw new Error('paginatedQuery() must be passed a query document')
	}

	// @ts-ignore: typing esm/cjs interop is hard
	const artifact: QueryArtifact = document.artifact.default || document.artifact

	// if there's no refetch config for the artifact there's a problem
	if (!artifact.refetch) {
		throw new Error('paginatedQuery must be passed a query with @paginate.')
	}

	// pass the artifact to the base query operation
	const { data, loading, refetch, partial, onLoad, ...restOfQueryResponse } = query(document)

	const paginationPartial = writable(false)
	partial.subscribe((val) => {
		paginationPartial.set(val)
	})

	return {
		data,
		partial: { subscribe: paginationPartial.subscribe },
		onLoad(newValue: QueryInputs<any>) {
			onLoad.call(this, newValue)
			// keep the partial store in sync
			paginationPartial.set(newValue.partial)
		},
		...paginationHandlers({
			config: document.config,
			initialValue: document.initialValue.data,
			store: data,
			artifact,
			queryVariables: () => document.variables,
			documentLoading: loading,
			refetch,
			partial: paginationPartial,
		}),
		...restOfQueryResponse,
	}
}

export function paginatedFragment<_Fragment extends Fragment<any>>(
	document: GraphQLTagResult,
	initialValue: _Fragment
): { data: Readable<_Fragment['shape']> } & PaginatedHandlers<null> {
	// make sure we got a query document
	if (document.kind !== 'HoudiniFragment') {
		throw new Error('paginatedFragment() must be passed a fragment document')
	}
	// if we don't have a pagination fragment there is a problem
	if (!document.paginationArtifact) {
		throw new Error('paginatedFragment must be passed a fragment with @paginate')
	}

	// pass the inputs to the normal fragment function
	const data = fragment(document, initialValue)

	// @ts-ignore: typing esm/cjs interop is hard
	const fragmentArtifact: FragmentArtifact = document.artifact.default || document.artifact

	const paginationArtifact: QueryArtifact =
		// @ts-ignore: typing esm/cjs interop is hard
		document.paginationArtifact.default || document.paginationArtifact

	const partial = writable(false)

	const { targetType } = paginationArtifact.refetch || {}
	const typeConfig = document.config.types?.[targetType || '']
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
			const keys = keyFieldsForType(document.config, targetType || '')
			// @ts-ignore
			queryVariables = () => Object.fromEntries(keys.map((key) => [key, initialValue[key]]))
		}
	}

	return {
		data,
		...paginationHandlers({
			config: document.config,
			partial,
			initialValue,
			store: data,
			artifact: paginationArtifact,
			queryVariables,
		}),
	}
}

function paginationHandlers<_Input>({
	initialValue,
	artifact,
	store,
	queryVariables,
	documentLoading,
	refetch,
	partial,
	config,
}: {
	initialValue: GraphQLObject
	artifact: QueryArtifact
	store: Readable<GraphQLObject>
	queryVariables?: () => {}
	documentLoading?: Readable<boolean>
	refetch?: RefetchFn
	partial: Writable<boolean>
	config: ConfigFile
}): PaginatedHandlers<_Input> {
	// start with the defaults and no meaningful page info
	let loadPreviousPage = defaultLoadPreviousPage
	let loadNextPage = defaultLoadNextPage
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

	let refetchQuery: RefetchFn
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
			partial,
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
			partial,
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

function cursorHandlers<_Input>({
	config,
	initialValue,
	artifact,
	store,
	queryVariables: extraVariables,
	loading,
	refetch,
	partial,
}: {
	config: ConfigFile
	initialValue: GraphQLObject
	artifact: QueryArtifact
	store: Readable<GraphQLObject>
	queryVariables?: () => {}
	loading: Writable<boolean>
	refetch?: RefetchFn
	partial: Writable<boolean>
}): PaginatedHandlers<_Input> {
	// pull out the context accessors
	const variables = getVariables()
	const sessionStore = getSession()

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
		pageSizeVar,
		input,
		functionName,
	}: {
		pageSizeVar: string
		functionName: string
		input: {}
	}) => {
		// set the loading state to true
		loading.set(true)

		// build up the variables to pass to the query
		const queryVariables: Record<string, any> = {
			...extraVariables,
			...variables(),
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
			sessionStore,
			false
		)

		partial.set(partialData)

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
		loadNextPage: async (pageCount?: number) => {
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
				pageSizeVar: 'first',
				functionName: 'loadNextPage',
				input,
			})
		},
		loadPreviousPage: async (pageCount?: number) => {
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
				pageSizeVar: 'last',
				functionName: 'loadPreviousPage',
				input,
			})
		},
		pageInfo: { subscribe: pageInfo.subscribe },
		async refetch(input: any) {
			// if this document shouldn't be refetched, don't do anything
			if (!refetch) {
				return
			}
			// if the input is different than the query variables then we just do everything like normal
			if (input && JSON.stringify(variables()) !== JSON.stringify(input)) {
				return refetch(input)
			}

			// we are updating the current set of items, count the number of items that currently exist
			// and ask for the full data set
			const count =
				countPage(artifact.refetch!.path.concat('edges'), value) ||
				artifact.refetch!.pageSize

			// build up the variables to pass to the query
			const queryVariables: Record<string, any> = {
				...variables(),
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
				sessionStore,
				false
			)
			partial.set(partialData)

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

function offsetPaginationHandler<_Data, _Input>({
	artifact,
	queryVariables: extraVariables,
	loading,
	refetch,
	initialValue,
	store,
	partial,
}: {
	artifact: QueryArtifact
	queryVariables?: {}
	loading: Writable<boolean>
	refetch?: RefetchFn
	initialValue: GraphQLObject
	store: Readable<GraphQLObject>
	partial: Writable<boolean>
}): {
	loadPage: PaginatedHandlers<_Input>['loadNextPage']
	refetch: PaginatedHandlers<_Input>['refetch']
} {
	// we need to track the most recent offset for this handler
	let currentOffset = (artifact.refetch?.start as number) || 0

	// grab the context getters
	const variables = getVariables()
	const sessionStore = getSession()

	// hold onto the current value
	let value = initialValue
	store.subscribe((val) => {
		value = val
	})

	return {
		loadPage: async (limit?: number) => {
			// build up the variables to pass to the query
			const queryVariables: Record<string, any> = {
				...variables(),
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
				sessionStore,
				false
			)
			partial.set(partialData)

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
		async refetch(input: any) {
			// if this document shouldn't be refetched, don't do anything
			if (!refetch) {
				return
			}
			// if the input is different than the query variables then we just do everything like normal
			if (input && JSON.stringify(variables()) !== JSON.stringify(input)) {
				return refetch(input)
			}

			// we are updating the current set of items, count the number of items that currently exist
			// and ask for the full data set
			const count = countPage(artifact.refetch!.path, value)

			// build up the variables to pass to the query
			const queryVariables: Record<string, any> = {
				...variables(),
				...extraVariables,
				limit: count,
			}

			// set the loading state to true
			loading.set(true)

			// send the query
			const { result, partial: partialData } = await executeQuery<GraphQLObject, {}>(
				artifact,
				queryVariables,
				sessionStore,
				false
			)

			partial.set(partialData)

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

type PaginatedHandlers<_Input> = {
	loadNextPage(pageCount?: number, after?: string | number): Promise<void>
	loadPreviousPage(pageCount?: number, before?: string): Promise<void>
	loading: Readable<boolean>
	pageInfo: Readable<PageInfo>
	refetch: (vars: _Input) => Promise<void>
}

function defaultLoadNextPage(): Promise<void> {
	throw new Error(
		'loadNextPage() only works on fields marked @paginate that implement forward cursor or offset pagination.'
	)
}

function defaultLoadPreviousPage(): Promise<void> {
	throw new Error(
		'loadPreviousPage() only works on fields marked @paginate that implement backward cursor pagination.'
	)
}

function missingPageSizeError(fnName: string) {
	return new Error(
		'Loading a page with no page size. If you are paginating a field with a variable page size, ' +
			`you have to pass a value to \`${fnName}\`. If you don't care to have the page size vary, ` +
			'consider passing a fixed value to the field instead.'
	)
}
