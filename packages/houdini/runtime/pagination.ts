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
} from './types'
import { query, QueryResponse } from './query'
import { getVariables } from './context'
import { executeQuery } from './network'
import cache from './cache'
// @ts-ignore: this file will get generated and does not exist in the source code
import { getSession } from './adapter.mjs'
// this has to be in a separate file since config isn't defined in cache/index.ts
import { extractPageInfo, PageInfo } from './utils'

type PaginatedQueryResponse<_Data, _Input> = {
	data: Readable<_Data>
	loadNextPage(pageCount?: number): Promise<void>
	loadPreviousPage(pageCount?: number): Promise<void>
	pageInfo: Readable<PageInfo>
} & QueryResponse<_Data, _Input>

export function paginatedQuery<_Query extends Operation<any, any>>(
	document: GraphQLTagResult
): PaginatedQueryResponse<_Query['result'], _Query['input']> {
	// make sure we got a query document
	if (document.kind !== 'HoudiniQuery') {
		throw new Error('paginatedQuery() must be passed a query document')
	}

	// pass the artifact to the base query operation
	const { data, ...restOfQueryResponse } = query(document)

	// if there's no refetch config for the artifact there's a problem
	if (!document.artifact.refetch) {
		throw new Error('paginatedQuery must be passed a query with @paginate.')
	}

	const variables = getVariables()
	const sessionStore = getSession()

	// track the current page info in an easy-to-reach store
	const pageInfo = writable<PageInfo>(
		extractPageInfo(document.initialValue.data, document.artifact.refetch!.target)
	)

	// hold onto the current value
	let value: _Query['result']
	data.subscribe((val) => {
		pageInfo.set(extractPageInfo(val, document.artifact.refetch!.target))
		value = val
	})

	const loadNextPage = async (pageCount?: number) => {
		// we need to find the connection object holding the current page info
		const currentPageInfo = extractPageInfo(value, document.artifact.refetch!.target)

		// if there is no next page, we're done
		if (!currentPageInfo.hasNextPage) {
			return
		}

		// build up the variables to pass to the query
		const queryVariables = {
			...variables(),
			first: pageCount,
			after: currentPageInfo.endCursor,
		}

		// send the query
		const result = await executeQuery<_Query['result']>(
			document.artifact as QueryArtifact,
			queryVariables,
			sessionStore
		)

		// we need to find the connection object holding the current page info
		pageInfo.set(extractPageInfo(result.data, document.artifact.refetch!.target))

		// update cache with the result
		cache.write({
			selection: document.artifact.selection,
			data: result.data,
			variables: queryVariables,
			applyUpdates: true,
		})
	}

	const loadPreviousPage = async (pageCount?: number) => {
		// we need to find the connection object holding the current page info
		const currentPageInfo = extractPageInfo(value, document.artifact.refetch!.target)

		// if there is no next page, we're done
		if (!currentPageInfo.hasPreviousPage) {
			return
		}

		// build up the variables to pass to the query
		const queryVariables = {
			...variables(),
			last: pageCount,
			before: currentPageInfo.startCursor,
		}

		// send the query
		const result = await executeQuery<_Query['result']>(
			document.artifact as QueryArtifact,
			queryVariables,
			sessionStore
		)

		// we need to find the connection object holding the current page info
		pageInfo.set(extractPageInfo(result.data, document.artifact.refetch!.target))

		// update cache with the result
		cache.write({
			selection: document.artifact.selection,
			data: result.data,
			variables: queryVariables,
			applyUpdates: true,
		})
	}

	return {
		data,
		loadNextPage,
		loadPreviousPage,
		pageInfo: { subscribe: pageInfo.subscribe },
		...restOfQueryResponse,
	}
}
