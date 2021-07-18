// externals
import { Readable } from 'svelte/store'
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
import { extractPageInfo } from './utils'

type PaginatedQueryResponse<_Data, _Input> = {
	data: Readable<_Data>
	loadNextPage(pageCount?: number): Promise<void>
} & QueryResponse<_Data, _Input>

export function paginatedQuery<_Query extends Operation<any, any>>(
	document: GraphQLTagResult
): PaginatedQueryResponse<_Query['result'], _Query['input']> {
	// pass the artifact to the base query operation
	const { data, writeData, ...restOfQueryResponse } = query(document)

	// if there's no refetch config for the artifact there's a problem
	if (!document.artifact.refetch) {
		throw new Error('paginatedQuery must be passed a query with @paginate.')
	}

	// hold onto the current value
	let value: _Query['result']
	data.subscribe((val) => {
		value = val
	})

	const variables = getVariables()
	const sessionStore = getSession()

	const loadNextPage = async (pageCount?: number) => {
		// we need to find the connection object holding the current page info
		const pageInfo = extractPageInfo(value, document.artifact.refetch!.target)

		// if there is no next page, we're done
		if (!pageInfo.hasNextPage) {
			return
		}

		// build up the variables to pass to the query
		const queryVariables = {
			...variables(),
			first: pageCount,
			after: pageInfo.endCursor,
		}

		// send the query
		const result = await executeQuery<_Query['result']>(
			document.artifact as QueryArtifact,
			queryVariables,
			sessionStore
		)

		// update cache with the result
		cache.write({
			selection: document.artifact.selection,
			data: result.data,
			variables: queryVariables,
			applyUpdates: true,
		})
	}

	return { data, writeData, loadNextPage, ...restOfQueryResponse }
}
