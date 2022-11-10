import { getCache } from '$houdini/runtime'
import { ConfigFile } from '$houdini/runtime/lib/config'
import { siteURL } from '$houdini/runtime/lib/constants'
import { deepEquals } from '$houdini/runtime/lib/deepEquals'
import { executeQuery } from '$houdini/runtime/lib/network'
import { GraphQLObject, QueryArtifact, QueryResult } from '$houdini/runtime/lib/types'
import { Writable, writable } from 'svelte/store'

import { getCurrentClient } from '../../network'
import { getSession } from '../../session'
import { QueryStoreFetchParams } from '../query'
import { fetchParams } from '../query'
import { FetchFn } from './fetch'
import { countPage, extractPageInfo, missingPageSizeError, PageInfo } from './pageInfo'

export function cursorHandlers<_Data extends GraphQLObject, _Input>({
	artifact,
	queryVariables: extraVariables,
	setFetching,
	fetch,
	storeName,
	getValue,
	getConfig,
}: {
	artifact: QueryArtifact
	getValue: () => _Data | null
	queryVariables: () => Promise<_Input | null>
	setFetching: (val: boolean) => void
	fetch: FetchFn<_Data, _Input>
	storeName: string
	getConfig: () => Promise<ConfigFile>
}): CursorHandlers<_Data, _Input> {
	const pageInfo = writable<PageInfo>(extractPageInfo(getValue(), artifact.refetch!.path))

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
		input: {}
		metadata?: {}
		fetch?: typeof globalThis.fetch
	}) => {
		const config = await getConfig()
		const client = await getCurrentClient()

		// build up the variables to pass to the query
		const loadVariables: Record<string, any> = {
			...(await extraVariables?.()),
			...input,
		}

		// if we don't have a value for the page size, tell the user
		if (!loadVariables[pageSizeVar] && !artifact.refetch!.pageSize) {
			throw missingPageSizeError(functionName)
		}

		// send the query
		const { result } = await executeQuery<GraphQLObject, {}>({
			client,
			artifact,
			variables: loadVariables,
			session: await getSession(),
			setFetching,
			cached: false,
			config,
			fetch,
			metadata,
		})

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
		pageInfo.set(extractPageInfo(result.data, resultPath))

		// update cache with the result
		getCache().write({
			selection: artifact.selection,
			data: result.data,
			variables: loadVariables,
			applyUpdates: true,
		})

		// we're not loading any more
		setFetching(false)
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
			const currentPageInfo = extractPageInfo(getValue(), artifact.refetch!.path)

			// if there is no next page, we're done
			if (!currentPageInfo.hasNextPage) {
				return
			}

			// only specify the page count if we're given one
			const input: Record<string, any> = {
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
			const currentPageInfo = extractPageInfo(getValue(), artifact.refetch!.path)

			// if there is no next page, we're done
			if (!currentPageInfo.hasPreviousPage) {
				return
			}

			// only specify the page count if we're given one
			const input: Record<string, any> = {
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
