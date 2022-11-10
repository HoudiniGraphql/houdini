import { getCache } from '$houdini/runtime'
import { ConfigFile } from '$houdini/runtime/lib/config'
import { deepEquals } from '$houdini/runtime/lib/deepEquals'
import { executeQuery } from '$houdini/runtime/lib/network'
import { GraphQLObject, QueryArtifact, QueryResult } from '$houdini/runtime/lib/types'

import { getCurrentClient } from '../../network'
import { getSession } from '../../session'
import { QueryStoreFetchParams } from '../query'
import { fetchParams } from '../query'
import { FetchFn } from './fetch'
import { countPage, missingPageSizeError } from './pageInfo'

export function offsetHandlers<_Data extends GraphQLObject, _Input>({
	artifact,
	queryVariables: extraVariables,
	fetch,
	getValue,
	setFetching,
	storeName,
	getConfig,
}: {
	artifact: QueryArtifact
	queryVariables: () => Promise<_Input | null>
	fetch: FetchFn<_Data, _Input>
	getValue: () => _Data | null
	storeName: string
	setFetching: (val: boolean) => void
	getConfig: () => Promise<ConfigFile>
}) {
	// we need to track the most recent offset for this handler
	let getOffset = () =>
		(artifact.refetch?.start as number) ||
		countPage(artifact.refetch!.path, getValue()) ||
		artifact.refetch!.pageSize

	let currentOffset = getOffset() ?? 0

	return {
		loadNextPage: async ({
			limit,
			offset,
			fetch,
			metadata,
		}: {
			limit?: number
			offset?: number
			fetch?: typeof globalThis.fetch
			metadata?: {}
		} = {}) => {
			const config = await getConfig()

			// if the offset is zero then we want to count it just to make sure
			// hence why (|| and not ??)
			offset ??= currentOffset || getOffset()

			// build up the variables to pass to the query
			const queryVariables: Record<string, any> = {
				...(await extraVariables()),
				offset,
			}
			if (limit || limit === 0) {
				queryVariables.limit = limit
			}

			// if we made it this far without a limit argument and there's no default page size,
			// they made a mistake
			if (!queryVariables.limit && !artifact.refetch!.pageSize) {
				throw missingPageSizeError('loadNextPage')
			}

			// send the query
			const { result } = await executeQuery<GraphQLObject, {}>({
				client: await getCurrentClient(),
				artifact,
				variables: queryVariables,
				session: await getSession(),
				cached: false,
				config,
				setFetching,
				fetch,
				metadata,
			})

			// update cache with the result
			getCache().write({
				selection: artifact.selection,
				data: result.data,
				variables: queryVariables,
				applyUpdates: true,
			})

			// add the page size to the offset so we load the next page next time
			const pageSize = queryVariables.limit || artifact.refetch!.pageSize
			currentOffset = offset + pageSize

			// we're not loading any more
			setFetching(false)
		},
		async fetch(
			args?: QueryStoreFetchParams<_Data, _Input>
		): Promise<QueryResult<_Data, _Input>> {
			const { params } = await fetchParams(artifact, storeName, args)

			const { variables } = params ?? {}

			const extra = await extraVariables()

			// if the input is different than the query variables then we just do everything like normal
			if (variables && !deepEquals(extra, variables)) {
				return fetch.call(this, params)
			}

			// we are updating the current set of items, count the number of items that currently exist
			// and ask for the full data set
			const count = currentOffset || getOffset()

			// build up the variables to pass to the query
			const queryVariables: Record<string, any> = {
				...extra,
			}

			// if there are more records than the first page, we need fetch to load everything
			if (!artifact.refetch!.pageSize || count > artifact.refetch!.pageSize) {
				queryVariables.limit = count
			}

			// send the query
			const result = await fetch.call(this, {
				...params,
				variables: queryVariables as _Input,
			})

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

export type OffsetHandlers<_Data extends GraphQLObject, _Input, _ReturnType> = {
	loadNextPage: (args?: {
		limit?: number
		offset?: number
		metadata?: {}
		fetch?: typeof globalThis.fetch
	}) => Promise<void>
	fetch(args?: QueryStoreFetchParams<_Data, _Input> | undefined): Promise<_ReturnType>
}
