// externals
import { readable, Readable, writable } from 'svelte/store'
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

	// pass the artifact to the base query operation
	const { data, ...restOfQueryResponse } = query(document)

	// if there's no refetch config for the artifact there's a problem
	if (!artifact.refetch) {
		throw new Error('paginatedQuery must be passed a query with @paginate.')
	}

	const { loadNextPage, loadPreviousPage, pageInfo } = paginationHandlers({
		initialValue: document.initialValue.data,
		store: data,
		artifact,
	})

	return {
		data,
		loadNextPage,
		loadPreviousPage,
		pageInfo: { subscribe: pageInfo.subscribe },
		...restOfQueryResponse,
	}
}

function paginationHandlers({
	initialValue,
	artifact,
	store,
}: {
	initialValue: GraphQLObject
	artifact: QueryArtifact
	store: Readable<GraphQLObject>
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

	// if the artifact supports cursor based pagination
	if (artifact.refetch?.method === 'cursor') {
		// generate the cursor handlers
		const handlers = cursorHandlers({ initialValue, artifact, store })
		// always track pageInfo
		pageInfo = handlers.pageInfo

		// if we are implementing forward pagination
		if (artifact.refetch.update === 'append') {
			loadNextPage = handlers.loadNextPage
		}
		// the artifact implements backwards pagination
		else {
			loadPreviousPage = handlers.loadPreviousPage
		}
	}
	// the artifact supports offset-based pagination, only loadNextPage is valid
	else {
		loadNextPage = offsetPaginationHandler({ artifact })
	}

	return { loadNextPage, loadPreviousPage, pageInfo }
}

function cursorHandlers({
	initialValue,
	artifact,
	store,
}: {
	initialValue: GraphQLObject
	artifact: QueryArtifact
	store: Readable<GraphQLObject>
}): PaginatedHandlers {
	const variables = getVariables()
	const sessionStore = getSession()

	// track the current page info in an easy-to-reach store
	const pageInfo = writable<PageInfo>(extractPageInfo(initialValue, artifact.refetch!.path))

	// hold onto the current value
	let value: GraphQLObject
	store.subscribe((val) => {
		pageInfo.set(extractPageInfo(val, artifact.refetch!.path))
		value = val
	})

	const loadNextPage = async (pageCount?: number, after?: string) => {
		// we need to find the connection object holding the current page info
		const currentPageInfo = extractPageInfo(value, artifact.refetch!.path)

		// if there is no next page, we're done
		if (!currentPageInfo.hasNextPage) {
			return
		}

		// build up the variables to pass to the query
		const queryVariables = {
			...variables(),
			first: pageCount,
			after: after || currentPageInfo.endCursor,
		}

		// send the query
		const result = await executeQuery<GraphQLObject>(
			artifact as QueryArtifact,
			queryVariables,
			sessionStore
		)

		// we need to find the connection object holding the current page info
		pageInfo.set(extractPageInfo(result.data, artifact.refetch!.path))

		// update cache with the result
		cache.write({
			selection: artifact.selection,
			data: result.data,
			variables: queryVariables,
			applyUpdates: true,
		})
	}

	const loadPreviousPage = async (pageCount?: number, before?: string) => {
		// we need to find the connection object holding the current page info
		const currentPageInfo = extractPageInfo(value, artifact.refetch!.path)

		// if there is no next page, we're done
		if (!currentPageInfo.hasPreviousPage) {
			return
		}

		// build up the variables to pass to the query
		const queryVariables = {
			...variables(),
			last: pageCount,
			before: before || currentPageInfo.startCursor,
		}

		// send the query
		const result = await executeQuery<GraphQLObject>(
			artifact as QueryArtifact,
			queryVariables,
			sessionStore
		)

		// we need to find the connection object holding the current page info
		pageInfo.set(extractPageInfo(result.data, artifact.refetch!.path))

		// update cache with the result
		cache.write({
			selection: artifact.selection,
			data: result.data,
			variables: queryVariables,
			applyUpdates: true,
		})
	}

	return {
		loadNextPage,
		loadPreviousPage,
		pageInfo,
	}
}

function offsetPaginationHandler({ artifact }: { artifact: QueryArtifact }) {
	// we need to track the most recent offset for this handler
	let currentOffset = (artifact.refetch?.start as number) || 0
	const pageSize = artifact.refetch?.pageSize || 10

	// grab the context getters
	const variables = getVariables()
	const sessionStore = getSession()

	return async (limit: number = pageSize) => {
		// build up the variables to pass to the query
		const queryVariables = {
			...variables(),
			offset: currentOffset,
			limit,
		}

		// send the query
		const result = await executeQuery<GraphQLObject>(
			artifact as QueryArtifact,
			queryVariables,
			sessionStore
		)

		// update cache with the result
		cache.write({
			selection: artifact.selection,
			data: result.data,
			variables: queryVariables,
			applyUpdates: true,
		})

		// add the page size to the offset so we load the next page next time
		currentOffset += limit
	}
}

type PaginatedHandlers = {
	loadNextPage(pageCount?: number, after?: string | number): Promise<void>
	loadPreviousPage(pageCount?: number, before?: string): Promise<void>
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
