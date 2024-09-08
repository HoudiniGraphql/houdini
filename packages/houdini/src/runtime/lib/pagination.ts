import type { SendParams } from '../client/documentStore'
import { getCurrentConfig } from './config'
import { deepEquals } from './deepEquals'
import { countPage, extractPageInfo, missingPageSizeError } from './pageInfo'
import { CachePolicy } from './types'
import type {
	CursorHandlers,
	FetchFn,
	GraphQLObject,
	GraphQLVariables,
	QueryArtifact,
	QueryResult,
	FetchParams,
} from './types'

let inFlightPageFetches: string[] = []

export function cursorHandlers<_Data extends GraphQLObject, _Input extends GraphQLVariables>({
	artifact,
	fetchUpdate: parentFetchUpdate,
	fetch: parentFetch,
	getState,
	getVariables,
	getSession,
}: {
	artifact: QueryArtifact
	getState: () => _Data | null
	getVariables: () => NonNullable<_Input>
	getSession: () => Promise<App.Session>
	fetch: FetchFn<_Data, _Input>
	fetchUpdate: (arg: SendParams, updates: string[]) => ReturnType<FetchFn<_Data, _Input>>
}): CursorHandlers<_Data, _Input> {
	// dry up the page-loading logic
	const loadPage = async ({
		pageSizeVar,
		input,
		functionName,
		metadata = {},
		fetch,
		where,
	}: {
		pageSizeVar: string
		functionName: string
		input: _Input
		metadata?: {}
		fetch?: typeof globalThis.fetch
		where: 'start' | 'end'
	}) => {
		const config = getCurrentConfig()

		// build up the variables to pass to the query
		const loadVariables: _Input = {
			...getVariables(),
			...input,
		}

		// if we don't have a value for the page size, tell the user
		if (!loadVariables[pageSizeVar] && !artifact.refetch!.pageSize) {
			throw missingPageSizeError(functionName)
		}

		// Get the in flight pagination fetches for this artifact.
		const pageFetchKey = `${artifact.name}:${where}`
		const inFlightIdx = inFlightPageFetches.findIndex((x) => x === pageFetchKey)
		// If this artifact and `where` combination exists, we can skip this exact same fetch.
		if (inFlightIdx >= 0) {
			return
		}

		// Get the Pagination Mode
		let isSinglePage = artifact.refetch?.mode === 'SinglePage'

		// Mark this page as currently fetching.
		inFlightPageFetches.push(pageFetchKey)

		// send the query
		await (isSinglePage ? parentFetch : parentFetchUpdate)(
			{
				variables: loadVariables,
				fetch,
				metadata,
				policy: isSinglePage ? artifact.policy : CachePolicy.NetworkOnly,
				session: await getSession(),
			},
			isSinglePage ? [] : [where === 'start' ? 'prepend' : 'append']
		)

		// Un-mark this page as currently fetching.
		inFlightPageFetches.splice(inFlightIdx)
	}

	const getPageInfo = () => {
		return extractPageInfo(getState(), artifact.refetch?.path ?? [])
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
			const currentPageInfo = getPageInfo()
			// if there is no next page, we're done
			if (!currentPageInfo.hasNextPage) {
				return
			}

			// only specify the page count if we're given one
			const input: any = {
				first: first ?? artifact.refetch!.pageSize,
				after: after ?? currentPageInfo.endCursor,
				before: null,
				last: null,
			}

			// load the page
			return await loadPage({
				pageSizeVar: 'first',
				functionName: 'loadNextPage',
				input,
				fetch,
				metadata,
				where: 'end',
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
			const currentPageInfo = getPageInfo()

			// if there is no next page, we're done
			if (!currentPageInfo.hasPreviousPage) {
				return
			}

			// only specify the page count if we're given one
			const input: any = {
				before: before ?? currentPageInfo.startCursor,
				last: last ?? artifact.refetch!.pageSize,
				first: null,
				after: null,
			}

			// load the page
			return await loadPage({
				pageSizeVar: 'last',
				functionName: 'loadPreviousPage',
				input,
				fetch,
				metadata,
				where: 'start',
			})
		},
		async fetch(args?: FetchParams<_Input>): Promise<QueryResult<_Data, _Input>> {
			const { variables } = args ?? {}

			// if the input is different than the query variables then we just do everything like normal
			if (variables && !deepEquals(getVariables(), variables)) {
				return await parentFetch(args)
			}

			// we need to find the connection object holding the current page info
			try {
				var currentPageInfo = extractPageInfo(getState(), artifact.refetch!.path)
			} catch {
				// if there was any issue getting the page info, just fetch like normal
				return await parentFetch(args)
			}

			// build up the variables to pass to the query
			const queryVariables: Record<string, any> = {}

			// we are updating the current set of items, count the number of items that currently exist
			// and ask for the full data set
			const count =
				countPage(artifact.refetch!.path.concat('edges'), getState()) ||
				artifact.refetch!.pageSize

			// if there are more records than the first page, we need fetch to load everything
			if (count && count > artifact.refetch!.pageSize) {
				// if we aren't at one of the boundaries, we can't refresh the current window
				// of a paginated field. warn the user if that's the case
				if (
					currentPageInfo.hasPreviousPage &&
					currentPageInfo.hasNextPage &&
					// only log if they haven't provided special parameters
					!(
						(variables?.['first'] && variables?.['after']) ||
						(variables?.['last'] && variables?.['before'])
					)
				) {
					console.warn(`⚠️ Encountered a fetch() in the middle of the connection.
Make sure to pass a cursor value by hand that includes the current set (ie the entry before startCursor)
`)
				}

				// if we are loading the first boundary
				if (!currentPageInfo.hasPreviousPage) {
					queryVariables['first'] = count
					queryVariables['after'] = null
					queryVariables['last'] = null
					queryVariables['before'] = null
				}

				// or we're loading the last boundary
				else if (!currentPageInfo.hasNextPage) {
					queryVariables['last'] = count
					queryVariables['first'] = null
					queryVariables['after'] = null
					queryVariables['before'] = null
				}
			}

			// let the user overwrite the variables
			Object.assign(queryVariables, variables ?? {})

			// send the query
			const result = await parentFetch({
				...args,
				variables: queryVariables as _Input,
			})

			return result
		},
	}
}

export function offsetHandlers<_Data extends GraphQLObject, _Input extends GraphQLVariables>({
	artifact,
	storeName,
	getState,
	getVariables,
	fetch: parentFetch,
	fetchUpdate: parentFetchUpdate,
	getSession,
}: {
	artifact: QueryArtifact
	fetch: FetchFn<_Data, _Input>
	fetchUpdate: (arg: SendParams) => ReturnType<FetchFn<_Data, _Input>>
	storeName: string
	getState: () => _Data | null
	getVariables: () => _Input
	getSession: () => Promise<App.Session>
}) {
	// Get the Pagination Mode
	let isSinglePage = artifact.refetch?.mode === 'SinglePage'

	// we need to track the most recent offset for this handler
	let getOffset = () => {
		let offset =
			(artifact.refetch?.start as number) ||
			countPage(artifact.refetch!.path, getState()) ||
			artifact.refetch!.pageSize

		// if we are loading single pages then we need to add the current offset to the page size
		if (isSinglePage) {
			offset += getVariables()?.offset ?? 0
		}

		return offset
	}

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
			// build up the variables to pass to the query
			const queryVariables: Record<string, any> = {
				...getVariables(),
				offset: offset ?? getOffset(),
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
			const targetFetch = isSinglePage ? parentFetch : parentFetchUpdate
			await targetFetch({
				variables: queryVariables as _Input,
				fetch,
				metadata,
				policy: isSinglePage ? artifact.policy : CachePolicy.NetworkOnly,
				session: await getSession(),
			})

			// add the page size to the offset so we load the next page next time
			const pageSize = queryVariables.limit || artifact.refetch!.pageSize
			currentOffset = offset + pageSize
		},
		async fetch(params: FetchParams<_Input> = {}): Promise<QueryResult<_Data, _Input>> {
			const { variables } = params

			// if the input is different than the query variables then we just do everything like normal
			if (variables && !deepEquals(getVariables(), variables)) {
				return parentFetch.call(this, params)
			}

			// we are updating the current set of items, count the number of items that currently exist
			// and ask for the full data set
			const count = currentOffset || getOffset()

			// build up the variables to pass to the query
			const queryVariables: Record<string, any> = {}

			// if there are more records than the first page, we need fetch to load everything
			if (!artifact.refetch!.pageSize || count > artifact.refetch!.pageSize) {
				queryVariables.limit = count
			}

			// send the query
			return await parentFetch.call(this, {
				...params,
				variables: queryVariables as _Input,
			})
		},
	}
}
