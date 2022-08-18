import { derived, get, Writable, writable } from 'svelte/store'

import {
	deepEquals,
	executeQuery,
	getCurrentConfig,
	GraphQLObject,
	HoudiniFetchContext,
} from '../lib'
import cache from '../cache'
import * as log from '../lib/log'
import {
	QueryStore,
	StoreConfig,
	fetchParams,
	LoadEventFetchParams,
	RequestEventFetchParams,
	QueryStoreFetchParams,
	ClientFetchParams,
	QueryResult,
} from './query'

// both cursor paginated stores add a page info to their subscribe
class CursorPaginatedStore<_Data extends GraphQLObject, _Input> extends QueryStore<_Data, _Input> {
	pageInfo: Writable<PageInfo>

	constructor(config: StoreConfig<_Data, _Input>) {
		super(config)
		this.pageInfo = writable(nullPageInfo())
	}

	subscribe(...args: Parameters<QueryStore<_Data, _Input>['subscribe']>) {
		// get the parent query result
		const query = { subscribe: super.subscribe }

		// mix the page info value into our store value
		const combined = derived([query, this.pageInfo], ([$store, $pageInfo]) => {
			return {
				...$store,
				pageInfo: $pageInfo,
			}
		})

		// subscribe to the combined store
		return combined.subscribe(...args)
	}

	fetch(params?: RequestEventFetchParams<_Input>): Promise<QueryResult<_Data, _Input>>
	fetch(params?: LoadEventFetchParams<_Input>): Promise<QueryResult<_Data, _Input>>
	fetch(params?: ClientFetchParams<_Input>): Promise<QueryResult<_Data, _Input>>
	fetch(params?: QueryStoreFetchParams<_Input>): Promise<QueryResult<_Data, _Input>>
	async fetch(args?: QueryStoreFetchParams<_Input>): Promise<QueryResult<_Data, _Input>> {
		// validate and prepare the request context for the current environment (client vs server)
		const { params } = fetchParams(this.context, this.artifact, this.storeName, args)

		const { variables } = params ?? {}

		// build up the variables to pass to the query
		const extra = await this.currentVariables()
		const queryVariables: Record<string, any> = {
			...extra,
			...variables,
		}

		// if the input is different than the query variables then we just do everything like normal
		if (variables && !deepEquals(extra, variables)) {
			const result = await super.fetch(params)
			this.pageInfo.set(extractPageInfo(result, this.artifact.refetch!.path))
		}

		// we are updating the current set of items, count the number of items that currently exist
		// and ask for the full data set
		const count =
			countPage(this.artifact.refetch!.path.concat('edges'), get(this.store).data) ||
			this.artifact.refetch!.pageSize

		// if there are more records than the first page, we need fetch to load everything
		if (count && count > this.artifact.refetch!.pageSize) {
			// reverse cursors need the last entries in the list
			queryVariables[this.artifact.refetch!.update === 'prepend' ? 'last' : 'first'] = count
		}

		// set the loading state to true
		this.setFetching(true)

		// send the query
		const result = await super.fetch({
			...params,
			variables: queryVariables as _Input,
		})

		// keep the page info store up to date
		this.pageInfo.set(extractPageInfo(result.data, this.artifact.refetch!.path))

		// we're not loading any more
		this.setFetching(false)

		return {
			data: result.data,
			variables: queryVariables as _Input,
			isFetching: false,
			partial: result.partial,
			errors: null,
			source: result.source,
		}
	}

	// dry up the page-loading logic
	protected async loadPage({
		houdiniContext,
		pageSizeVar,
		input,
		functionName,
	}: {
		houdiniContext: HoudiniFetchContext
		pageSizeVar: string
		functionName: string
		input: {}
	}) {
		const config = await getCurrentConfig()

		// set the loading state to true
		this.setFetching(true)

		// build up the variables to pass to the query
		const loadVariables: Record<string, any> = {
			...get(this.store)?.variables,
			...houdiniContext.variables(),
			...input,
		}

		// if we don't have a value for the page size, tell the user
		if (!loadVariables[pageSizeVar] && !this.artifact.refetch!.pageSize) {
			throw missingPageSizeError(functionName)
		}

		// send the query
		const { result } = await executeQuery<GraphQLObject, {}>({
			artifact: this.artifact,
			variables: loadVariables,
			session: houdiniContext.session?.(),
			cached: false,
			config,
		})

		// if the query is embedded in a node field (paginated fragments)
		// make sure we look down one more for the updated page info
		const resultPath = [...this.artifact.refetch!.path]
		if (this.artifact.refetch!.embedded) {
			const { targetType } = this.artifact.refetch!
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
		this.pageInfo.set(extractPageInfo(result.data, resultPath))

		// update cache with the result
		cache.write({
			selection: this.artifact.selection,
			data: result.data,
			variables: loadVariables,
			applyUpdates: true,
		})

		// we're not loading any more
		this.setFetching(false)
	}
}

// ForwardCursorPaginatedQueryStore adds loadNextPage to CursorPaginatedQueryStore
export class ForwardCursorPaginatedQueryStore<
	_Data extends GraphQLObject,
	_Input
> extends CursorPaginatedStore<_Data, _Input> {
	async loadNextPage(pageCount?: number, after?: string, ctx?: HoudiniFetchContext) {
		const houdiniContext = ctx ?? this.context
		if (!houdiniContext) {
			throw contextError
		}
		// we need to find the connection object holding the current page info
		const currentPageInfo = extractPageInfo(get(this.store), this.artifact.refetch!.path)

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
		return await this.loadPage({
			houdiniContext,
			pageSizeVar: 'first',
			functionName: 'loadNextPage',
			input,
		})
	}
}

// BackwardCursorPaginatedQueryStore adds loadPreviousPage to CursorPaginatedQueryStore
export class BackwardCursorPaginatedQueryStore<
	_Data extends GraphQLObject,
	_Input
> extends CursorPaginatedStore<_Data, _Input> {
	async loadPreviousPage(pageCount?: number, before?: string, ctx?: HoudiniFetchContext) {
		const houdiniContext = ctx ?? this.context
		if (!houdiniContext) {
			throw contextError
		}
		// we need to find the connection object holding the current page info
		const currentPageInfo = extractPageInfo(get(this.store), this.artifact.refetch!.path)

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
		return await this.loadPage({
			houdiniContext,
			pageSizeVar: 'last',
			functionName: 'loadPreviousPage',
			input,
		})
	}
}

export class OffsetPaginatedQueryStore<_Data extends GraphQLObject, _Input> extends QueryStore<
	_Data,
	_Input
> {
	async loadPage(limit?: number, offset?: number, ctx?: HoudiniFetchContext) {
		const config = await getCurrentConfig()

		const houdiniContext = ctx ?? this.context
		if (!houdiniContext) {
			throw contextError
		}

		offset ??= this.currentOffset

		// build up the variables to pass to the query
		const queryVariables: Record<string, any> = {
			...houdiniContext.variables(),
			...(await this.currentVariables()),
			offset,
		}
		if (limit || limit === 0) {
			queryVariables.limit = limit
		}

		// if we made it this far without a limit argument and there's no default page size,
		// they made a mistake
		if (!queryVariables.limit && !this.artifact.refetch!.pageSize) {
			throw missingPageSizeError('loadNextPage')
		}

		// set the loading state to true
		this.setFetching(true)

		// send the query
		const { result } = await executeQuery<GraphQLObject, {}>({
			artifact: this.artifact,
			variables: queryVariables,
			session: houdiniContext.session?.(),
			cached: false,
			config,
		})

		// update cache with the result
		cache.write({
			selection: this.artifact.selection,
			data: result.data,
			variables: queryVariables,
			applyUpdates: true,
		})

		// we're not loading any more
		this.setFetching(false)
	}

	fetch(params?: RequestEventFetchParams<_Input>): Promise<QueryResult<_Data, _Input>>
	fetch(params?: LoadEventFetchParams<_Input>): Promise<QueryResult<_Data, _Input>>
	fetch(params?: ClientFetchParams<_Input>): Promise<QueryResult<_Data, _Input>>
	fetch(params?: QueryStoreFetchParams<_Input>): Promise<QueryResult<_Data, _Input>>
	async fetch(args?: QueryStoreFetchParams<_Input>): Promise<QueryResult<_Data, _Input>> {
		const { params } = fetchParams(this.context, this.artifact, this.storeName, args)

		const { variables } = params ?? {}

		const extra = await this.currentVariables()

		// if the input is different than the query variables then we just do everything like normal
		if (variables && !deepEquals(extra, variables)) {
			return super.fetch(params)
		}

		// we are updating the current set of items, count the number of items that currently exist
		// and ask for the full data set
		const count =
			countPage(this.artifact.refetch!.path, get(this.store).data) ||
			this.artifact.refetch!.pageSize

		// build up the variables to pass to the query
		const queryVariables: Record<string, any> = {
			...extra,
		}

		// if there are more records than the first page, we need fetch to load everything
		if (count > this.artifact.refetch!.pageSize) {
			queryVariables.limit = count
		}

		// set the loading state to true
		this.setFetching(true)

		// send the query
		const result = await super.fetch({
			...params,
			variables: queryVariables as _Input,
		})

		// we're not loading any more
		this.setFetching(false)

		return {
			data: result.data,
			variables: queryVariables as _Input,
			isFetching: false,
			partial: result.partial,
			errors: null,
			source: result.source,
		}
	}

	private get currentOffset() {
		return (
			(this.artifact.refetch?.start as number) ||
			countPage(this.artifact.refetch!.path, get(this.store).data) ||
			this.artifact.refetch!.pageSize
		)
	}
}

function missingPageSizeError(fnName: string) {
	// TODO: text
	return 'missing page size. need good content here.'
}

export function extractPageInfo(data: any, path: string[]): PageInfo {
	if (!data) {
		return {
			startCursor: null,
			endCursor: null,
			hasNextPage: false,
			hasPreviousPage: false,
		}
	}

	let localPath = [...path]
	// walk down the object until we get to the end
	let current = data
	while (localPath.length > 0) {
		if (!current) {
			break
		}
		current = current[localPath.shift() as string] as GraphQLObject
	}

	return (current?.pageInfo as PageInfo) ?? nullPageInfo()
}

export function countPage<_Data extends GraphQLObject>(
	source: string[],
	value: _Data | null
): number {
	let data = value
	if (value === null || data === null || data === undefined) {
		return 0
	}

	for (const field of source) {
		const obj = data[field] as _Data | _Data[]
		if (obj && !Array.isArray(obj)) {
			data = obj
		} else if (!data) {
			throw new Error('Could not count page size')
		}

		if (Array.isArray(obj)) {
			return obj.length
		}
	}

	return 0
}
function nullPageInfo(): PageInfo {
	return { startCursor: null, endCursor: null, hasNextPage: false, hasPreviousPage: false }
}

const contextError = `${log.red('⚠️ Could not find houdini context for a pagination method ⚠️')}
This really shouldn't happen. Please open a ticket describing your situation. 

In the meantime, you will need to do something like the following. Make sure getHoudiniContext is 
called at the top of your component (outside any event handlers or function definitions) and then 
passed to the method:

<script lang="ts">
    const ${log.yellow('context')} = getHoudiniContext();

    const onClick = () => GQL_${log.cyan('[YOUR_STORE]')}.loadNextPage(null, null, ${log.yellow(
	'context'
)});
</script>`

type PageInfo = {
	startCursor: string | null
	endCursor: string | null
	hasNextPage: boolean
	hasPreviousPage: boolean
}
