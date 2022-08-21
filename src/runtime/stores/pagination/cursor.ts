import { Writable, writable } from 'svelte/store'

import cache from '../../cache'
import { getCurrentConfig } from '../../lib/config'
import { deepEquals } from '../../lib/deepEquals'
import { executeQuery } from '../../lib/network'
import { GraphQLObject, HoudiniFetchContext, QueryArtifact } from '../../lib/types'
import { QueryResult, QueryStoreFetchParams } from '../query'
import { fetchParams } from '../query'
import { FetchFn } from './fetch'
import {
	contextError,
	countPage,
	extractPageInfo,
	missingPageSizeError,
	nullPageInfo,
	PageInfo,
} from './pageInfo'

export function cursorHandlers<_Data extends GraphQLObject, _Input>({
	artifact,
	queryVariables: extraVariables,
	setFetching,
	fetch,
	storeName,
	getValue,
	getContext,
}: {
	artifact: QueryArtifact
	getValue: () => _Data | null
	queryVariables: () => Promise<_Input | null>
	setFetching: (val: boolean) => void
	fetch: FetchFn<_Data, _Input>
	storeName: string
	getContext: () => HoudiniFetchContext | null
}): CursorHandlers<_Data, _Input> {
	const pageInfo = writable<PageInfo>(extractPageInfo(getValue(), artifact.refetch!.path))

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
		const config = await getCurrentConfig()

		// set the loading state to true
		setFetching(true)

		// build up the variables to pass to the query
		const loadVariables: Record<string, any> = {
			...(await extraVariables?.()),
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
		setFetching(false)
	}

	return {
		loadNextPage: async (pageCount?: number, after?: string, ctx?: HoudiniFetchContext) => {
			const houdiniContext = getContext() ?? ctx
			if (!houdiniContext) {
				throw contextError
			}
			// we need to find the connection object holding the current page info
			const currentPageInfo = extractPageInfo(getValue(), artifact.refetch!.path)

			// if there is no next page, we're done
			if (!currentPageInfo.hasNextPage) {
				return
			}

			// only specify the page count if we're given one
			const input: Record<string, any> = {
				after: after ?? currentPageInfo.endCursor,
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
		loadPreviousPage: async (
			pageCount?: number,
			before?: string,
			ctx?: HoudiniFetchContext
		) => {
			const houdiniContext = getContext() ?? ctx
			if (!houdiniContext) {
				throw contextError
			}
			// we need to find the connection object holding the current page info
			const currentPageInfo = extractPageInfo(getValue(), artifact.refetch!.path)

			// if there is no next page, we're done
			if (!currentPageInfo.hasPreviousPage) {
				return
			}

			// only specify the page count if we're given one
			const input: Record<string, any> = {
				before: before ?? currentPageInfo.startCursor,
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
		async fetch(
			args?: QueryStoreFetchParams<_Data, _Input>
		): Promise<QueryResult<_Data, _Input>> {
			// validate and prepare the request context for the current environment (client vs server)
			const { params } = fetchParams(getContext(), artifact, storeName, args)

			const { variables } = params ?? {}

			// build up the variables to pass to the query
			const extra = await extraVariables()
			const queryVariables: Record<string, any> = {
				...extra,
				...variables,
			}

			// if the input is different than the query variables then we just do everything like normal
			if (variables && !deepEquals(extra, variables)) {
				const result = await fetch({
					...params,
					then(data) {
						pageInfo.set(extractPageInfo(data, artifact.refetch!.path))
					},
				})
				return result
			}

			// we are updating the current set of items, count the number of items that currently exist
			// and ask for the full data set
			const count =
				countPage(artifact.refetch!.path.concat('edges'), getValue()) ||
				artifact.refetch!.pageSize

			// if there are more records than the first page, we need fetch to load everything
			if (count && count > artifact.refetch!.pageSize) {
				// reverse cursors need the last entries in the list
				queryVariables[artifact.refetch!.update === 'prepend' ? 'last' : 'first'] = count
			}

			// set the loading state to true
			setFetching(true)

			// send the query
			const result = await fetch({
				...params,
				variables: queryVariables as _Input,
			})

			// keep the page info store up to date
			pageInfo.set(extractPageInfo(result.data, artifact.refetch!.path))

			// we're not loading any more
			setFetching(false)

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

export type CursorHandlers<_Data extends GraphQLObject, _Input> = {
	loadNextPage: (
		pageCount?: number | undefined,
		after?: string | undefined,
		ctx?: HoudiniFetchContext | undefined
	) => Promise<void>
	loadPreviousPage: (
		pageCount?: number | undefined,
		before?: string | undefined,
		ctx?: HoudiniFetchContext | undefined
	) => Promise<void>
	pageInfo: Writable<PageInfo>
	fetch(
		args?: QueryStoreFetchParams<_Data, _Input> | undefined
	): Promise<QueryResult<_Data, _Input>>
}
