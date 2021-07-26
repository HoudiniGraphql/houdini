// externals
import { derived, readable, Readable, Writable, writable } from 'svelte/store'
// locals
import {
	Operation,
	GraphQLTagResult,
	Fragment,
	GraphQLObject,
	QueryArtifact,
	TaggedGraphqlQuery,
	FragmentArtifact,
} from './types'
import { query, QueryResponse } from './query'
import { fragment } from './fragment'
import { getVariables } from './context'
import { executeQuery } from './network'
import cache from './cache'
// @ts-ignore: this file will get generated and does not exist in the source code
import { getSession } from './adapter.mjs'
// this has to be in a separate file since config isn't defined in cache/index.ts
import { extractPageInfo, PageInfo } from './utils'

export function paginatedQuery<_Query extends Operation<any, any>>(
	document: GraphQLTagResult
): QueryResponse<_Query['result'], _Query['input']> & PaginatedHandlers {
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
	const { data, loading, ...restOfQueryResponse } = query(document)

	return {
		data,
		...paginationHandlers({
			initialValue: document.initialValue.data,
			store: data,
			artifact,
			documentLoading: loading,
		}),
		...restOfQueryResponse,
	}
}

export function paginatedFragment<_Fragment extends Fragment<any>>(
	document: GraphQLTagResult,
	initialValue: _Fragment
): { data: Readable<_Fragment['shape']> } & PaginatedHandlers {
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

	return {
		data,
		...paginationHandlers({
			initialValue,
			store: data,
			artifact: paginationArtifact,
			queryVariables: paginationArtifact.refetch!.embedded
				? { id: cache.internal.computeID(fragmentArtifact.rootType, initialValue) }
				: {},
		}),
	}
}

function paginationHandlers({
	initialValue,
	artifact,
	store,
	queryVariables,
	documentLoading,
}: {
	initialValue: GraphQLObject
	artifact: QueryArtifact
	store: Readable<GraphQLObject>
	queryVariables?: {}
	documentLoading?: Readable<boolean>
}): PaginatedHandlers {
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

	let paginationLoadingState = writable(false)

	// if the artifact supports cursor based pagination
	if (artifact.refetch?.method === 'cursor') {
		// generate the cursor handlers
		const cursor = cursorHandlers({
			initialValue,
			artifact,
			store,
			queryVariables,
			loading: paginationLoadingState,
		})
		// always track pageInfo
		pageInfo = cursor.pageInfo

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
		loadNextPage = offsetPaginationHandler({
			artifact,
			queryVariables,
			loading: paginationLoadingState,
		})
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

	return { loadNextPage, loadPreviousPage, pageInfo, loading }
}

function cursorHandlers({
	initialValue,
	artifact,
	store,
	queryVariables: extraVariables,
	loading,
}: {
	initialValue: GraphQLObject
	artifact: QueryArtifact
	store: Readable<GraphQLObject>
	queryVariables?: {}
	loading: Writable<boolean>
}): {
	loadNextPage: PaginatedHandlers['loadNextPage']
	loadPreviousPage: PaginatedHandlers['loadPreviousPage']
	pageInfo: PaginatedHandlers['pageInfo']
} {
	// pull out the context accessors
	const variables = getVariables()
	const sessionStore = getSession()

	// track the current page info in an easy-to-reach store
	const initialPageInfo = initialValue
		? extractPageInfo(initialValue, artifact.refetch!.path)
		: {
				startCursor: null,
				endCursor: null,
				hasNextPage: false,
				hasPreviousPage: false,
		  }
	const pageInfo = writable<PageInfo>(initialPageInfo)

	// hold onto the current value
	let value: GraphQLObject
	store.subscribe((val) => {
		pageInfo.set(extractPageInfo(val, artifact.refetch!.path))
		value = val
	})

	// dry up the page-loading logic
	const loadPage = async (input: {}) => {
		// set the loading state to true
		loading.set(true)

		// build up the variables to pass to the query
		const queryVariables = {
			...variables(),
			...input,
			...extraVariables,
		}

		// send the query
		const result = await executeQuery<GraphQLObject>(artifact, queryVariables, sessionStore)

		// if the query is embedded in a node field (paginated fragments)
		// make sure we look down one more for the updated page info
		const resultPath = [...artifact.refetch!.path]
		if (artifact.refetch!.embedded) {
			resultPath.unshift('node')
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
		loadNextPage: async (pageCount?: number) => {
			// we need to find the connection object holding the current page info
			const currentPageInfo = extractPageInfo(value, artifact.refetch!.path)

			// if there is no next page, we're done
			if (!currentPageInfo.hasNextPage) {
				return
			}

			// if we weren't given a page count but there's no default value in the query
			// the user will receive an error from the API - let's give them something more useful
			if (!pageCount && !artifact.refetch!.pageSize) {
				throw missingPageSizeError('loadNextPage')
			}

			return await loadPage({
				first: pageCount,
				after: currentPageInfo.endCursor,
			})
		},
		loadPreviousPage: async (pageCount?: number) => {
			// we need to find the connection object holding the current page info
			const currentPageInfo = extractPageInfo(value, artifact.refetch!.path)

			// if there is no next page, we're done
			if (!currentPageInfo.hasPreviousPage) {
				return
			}

			// if we weren't given a page count but there's no default value in the query
			// the user will receive an error from the API - let's give them something more useful
			if (!pageCount && !artifact.refetch!.pageSize) {
				throw missingPageSizeError('loadPreviousPage')
			}

			return await loadPage({
				last: pageCount,
				before: currentPageInfo.startCursor,
			})
		},
		pageInfo: { subscribe: pageInfo.subscribe },
	}
}

function offsetPaginationHandler({
	artifact,
	queryVariables: extraVariables,
	loading,
}: {
	artifact: QueryArtifact
	queryVariables?: {}
	loading: Writable<boolean>
}): PaginatedHandlers['loadNextPage'] {
	// we need to track the most recent offset for this handler
	let currentOffset = (artifact.refetch?.start as number) || 0

	// grab the context getters
	const variables = getVariables()
	const sessionStore = getSession()

	return async (limit?: number) => {
		// figure out the page size
		const pageSize = limit || artifact.refetch?.pageSize
		if (!pageSize) {
			throw missingPageSizeError('loadNextPage')
		}

		// build up the variables to pass to the query
		const queryVariables = {
			...variables(),
			...extraVariables,
			offset: currentOffset,
			limit: pageSize,
		}

		// set the loading state to true
		loading.set(true)

		// send the query
		const result = await executeQuery<GraphQLObject>(artifact, queryVariables, sessionStore)

		// update cache with the result
		cache.write({
			selection: artifact.selection,
			data: result.data,
			variables: queryVariables,
			applyUpdates: true,
		})

		// add the page size to the offset so we load the next page next time
		currentOffset += pageSize

		// we're not loading any more
		loading.set(false)
	}
}

type PaginatedHandlers = {
	loadNextPage(pageCount?: number, after?: string | number): Promise<void>
	loadPreviousPage(pageCount?: number, before?: string): Promise<void>
	loading: Readable<boolean>
	pageInfo: Readable<PageInfo>
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
