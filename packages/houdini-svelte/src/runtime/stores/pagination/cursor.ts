import { DocumentObserver } from '$houdini/runtime/client/documentObserver'
import { getCurrentConfig } from '$houdini/runtime/lib/config'
import { siteURL } from '$houdini/runtime/lib/constants'
import { deepEquals } from '$houdini/runtime/lib/deepEquals'
import { GraphQLObject, QueryArtifact, QueryResult } from '$houdini/runtime/lib/types'
import { get, Writable, writable } from 'svelte/store'

import { QueryStoreFetchParams } from '../query'
import { fetchParams } from '../query'
import { FetchFn } from './fetch'
import { countPage, extractPageInfo, missingPageSizeError, PageInfo } from './pageInfo'

export function cursorHandlers<_Data extends GraphQLObject, _Input extends Record<string, any>>({
	artifact,
	storeName,
	observer,
	fetch: parentFetch,
}: {
	artifact: QueryArtifact
	storeName: string
	observer: DocumentObserver<_Data, _Input>
	fetch: FetchFn<_Data, _Input>
}): CursorHandlers<_Data, _Input> {
	const pageInfo = writable<PageInfo>(extractPageInfo(get(observer).data, artifact.refetch!.path))

	const getValue = () => get(observer)

	// dry up the page-loading logic
	const loadPage = async ({
		pageSizeVar,
		input,
		functionName,
		metadata = {},
		fetch,
	}: {
		pageSizeVar: string
		functionName: string
		input: _Input
		metadata?: {}
		fetch?: typeof globalThis.fetch
	}) => {
		const config = getCurrentConfig()

		// if we don't have a value for the page size, tell the user
		if (!input[pageSizeVar] && !artifact.refetch!.pageSize) {
			throw missingPageSizeError(functionName)
		}

		// send the query
		const { data } = await parentFetch({ variables: input, fetch, metadata })

		// if the query is embedded in a node field (paginated fragments)
		// make sure we look down one more for the updated page info
		const resultPath = [...artifact.refetch!.path]
		if (artifact.refetch!.embedded) {
			const { targetType } = artifact.refetch!
			// make sure we have a type config for the pagination target type
			if (!config.types?.[targetType]?.resolve) {
				throw new Error(
					`Missing type resolve configuration for ${targetType}. For more information, see ${siteURL}/guides/pagination#paginated-fragments`
				)
			}

			// make sure that we pull the value out of the correct query field
			resultPath.unshift(config.types[targetType].resolve!.queryField)
		}

		// we need to find the connection object holding the current page info
		pageInfo.set(extractPageInfo(data, resultPath))
	}

	return {
		loadNextPage: async ({
			first,
			after,
			fetch,
			metadata,
		}: {
			first?: number
			after?: string
			fetch?: typeof globalThis.fetch
			metadata?: {}
		} = {}) => {
			// we need to find the connection object holding the current page info
			const currentPageInfo = extractPageInfo(getValue().data, artifact.refetch!.path)

			// if there is no next page, we're done
			if (!currentPageInfo.hasNextPage) {
				return
			}

			// only specify the page count if we're given one
			const input: any = {
				after: after ?? currentPageInfo.endCursor,
			}
			if (first) {
				input.first = first
			}

			// load the page
			return await loadPage({
				pageSizeVar: 'first',
				functionName: 'loadNextPage',
				input,
				fetch,
				metadata,
			})
		},
		loadPreviousPage: async ({
			last,
			before,
			fetch,
			metadata,
		}: {
			last?: number
			before?: string
			fetch?: typeof globalThis.fetch
			metadata?: {}
		} = {}) => {
			// we need to find the connection object holding the current page info
			const currentPageInfo = extractPageInfo(getValue().data, artifact.refetch!.path)

			// if there is no next page, we're done
			if (!currentPageInfo.hasPreviousPage) {
				return
			}

			// only specify the page count if we're given one
			const input: any = {
				before: before ?? currentPageInfo.startCursor,
			}
			if (last) {
				input.last = last
			}

			// load the page
			return await loadPage({
				pageSizeVar: 'last',
				functionName: 'loadPreviousPage',
				input,
				fetch,
				metadata,
			})
		},
		pageInfo,
		async fetch(
			args?: QueryStoreFetchParams<_Data, _Input>
		): Promise<QueryResult<_Data, _Input>> {
			// validate and prepare the request context for the current environment (client vs server)
			const { params } = await fetchParams(artifact, storeName, args)

			const { variables } = params ?? {}

			// build up the variables to pass to the query
			const queryVariables: Record<string, any> = {
				...variables,
			}

			// if the input is different than the query variables then we just do everything like normal
			if (variables && !deepEquals(getValue().variables, variables)) {
				return await this.fetch({
					...params,
					then(data) {
						pageInfo.set(extractPageInfo(data, artifact.refetch!.path))
					},
				})
			}

			// we are updating the current set of items, count the number of items that currently exist
			// and ask for the full data set
			const count =
				countPage(artifact.refetch!.path.concat('edges'), getValue().data) ||
				artifact.refetch!.pageSize

			// if there are more records than the first page, we need fetch to load everything
			if (count && count > artifact.refetch!.pageSize) {
				// reverse cursors need the last entries in the list
				queryVariables[artifact.refetch!.update === 'prepend' ? 'last' : 'first'] = count
			}

			// send the query
			const result = await this.fetch({
				...params,
				variables: queryVariables as _Input,
			})

			// keep the page info store up to date
			pageInfo.set(extractPageInfo(result.data, artifact.refetch!.path))

			return result
		},
	}
}

export type CursorHandlers<_Data extends GraphQLObject, _Input> = {
	loadNextPage: (args?: {
		first?: number
		after?: string
		fetch?: typeof globalThis.fetch
		metadata: {}
	}) => Promise<void>
	loadPreviousPage: (args?: {
		last?: number
		before?: string
		fetch?: typeof globalThis.fetch
		metadata?: {}
	}) => Promise<void>
	pageInfo: Writable<PageInfo>
	fetch(
		args?: QueryStoreFetchParams<_Data, _Input> | undefined
	): Promise<QueryResult<_Data, _Input>>
}
