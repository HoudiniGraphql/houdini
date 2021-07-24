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

	// pass the artifact to the base query operation
	const { data, ...restOfQueryResponse } = query(document)

	// if there's no refetch config for the artifact there's a problem
	if (!artifact.refetch) {
		throw new Error('paginatedQuery must be passed a query with @paginate.')
	}

	return {
		data,
		...paginationHandlers({
			initialValue: document.initialValue.data,
			store: data,
			artifact,
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
		throw new Error('getFragment can only take fragment documents')
	}

	// pass the inputs to the normal fragment function
	const data = fragment(document, initialValue)

	// if we don't have a pagination fragment there is a problem
	if (!document.paginationArtifact) {
		throw new Error('paginatedFragment must be passed a fragment with @paginate')
	}

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
}: {
	initialValue: GraphQLObject
	artifact: QueryArtifact
	store: Readable<GraphQLObject>
	queryVariables?: {}
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
		const cursor = cursorHandlers({ initialValue, artifact, store })
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
		loadNextPage = offsetPaginationHandler({ artifact })
	}

	return { loadNextPage, loadPreviousPage, pageInfo }
}

function cursorHandlers({
	initialValue,
	artifact,
	store,
	queryVariables,
}: {
	initialValue: GraphQLObject
	artifact: QueryArtifact
	store: Readable<GraphQLObject>
	queryVariables?: {}
}): PaginatedHandlers {
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
	}

	return {
		loadNextPage,
		loadPreviousPage,
		pageInfo: { subscribe: pageInfo.subscribe },
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
