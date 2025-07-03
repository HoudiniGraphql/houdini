import type {
	FetchQueryResult,
	CompiledFragmentKind,
	QueryResult,
	GraphQLObject,
	CursorHandlers,
	OffsetHandlers,
	PageInfo,
	HoudiniFetchContext,
	FetchParams,
} from '$houdini/runtime/lib/types'
import type { LoadEvent, RequestEvent } from '@sveltejs/kit'
import type { Readable } from 'svelte/store'

export type QueryInputs<_Data> = FetchQueryResult<_Data> & { variables: { [key: string]: any } }

export type VariableFunction<_Event extends LoadEvent, _Input> = (
	event: _Event
) => _Input | Promise<_Input>

export type AfterLoadFunction<
	_Params extends Record<string, string>,
	_Data,
	_Input,
	_ReturnType extends Record<string, any>
> = (args: { event: LoadEvent<_Params>; data: _Data; input: _Input }) => _ReturnType

export type BeforeLoadFunction<
	_Params extends Record<string, string>,
	_ReturnType extends Record<string, any> | void
> = (event: LoadEvent<_Params>) => _ReturnType

export type BeforeLoadArgs = LoadEvent
export type AfterLoadArgs = {
	event: LoadEvent
	input: Record<string, any>
	data: Record<string, any>
}
export type OnErrorArgs = {
	event: LoadEvent
	input: Record<string, any>
}

export type KitLoadResponse = {
	status?: number
	error?: Error
	redirect?: string
	props?: Record<string, any>
	context?: Record<string, any>
	maxage?: number
}

export type FragmentStoreInstance<_Data, _Input> = Readable<_Data> & {
	variables: _Input
	kind: typeof CompiledFragmentKind
}

type Reshape<_Data, _Input> = Omit<QueryResult<_Data, _Input>, 'data'> & { data: _Data }

export type CursorFragmentStoreInstance<_Data extends GraphQLObject, _Input> = {
	kind: typeof CompiledFragmentKind
	data: Readable<_Data>
	subscribe: Readable<Reshape<_Data, _Input> & { pageInfo: PageInfo }>['subscribe']
	fetching: Readable<boolean>
} & CursorHandlers<_Data, _Input>

export type OffsetFragmentStoreInstance<_Data extends GraphQLObject, _Input> = {
	kind: typeof CompiledFragmentKind
	data: Readable<_Data>
	subscribe: Readable<Reshape<_Data, _Input>>['subscribe']
	fetching: Readable<boolean>
} & OffsetHandlers<_Data, _Input>

type FetchGlobalParams<_Data extends GraphQLObject, _Input> = FetchParams<_Input> & {
	/**
	 * Set to true if you want the promise to pause while it's resolving.
	 * Only enable this if you know what you are doing. This will cause route
	 * transitions to pause while loading data.
	 */
	blocking?: boolean

	/**
	 * A function to call after the fetch happens (whether fake or not)
	 */
	then?: (val: _Data | null) => void | Promise<void>
}

export type LoadEventFetchParams<_Data extends GraphQLObject, _Input> = FetchGlobalParams<
	_Data,
	_Input
> & {
	/**
	 * Directly the `event` param coming from the `load` function
	 */
	event?: LoadEvent
}

export type RequestEventFetchParams<_Data extends GraphQLObject, _Input> = FetchGlobalParams<
	_Data,
	_Input
> & {
	/**
	 * A RequestEvent should be provided when the store is being used in an endpoint.
	 * When this happens, fetch also needs to be provided
	 */
	event?: RequestEvent
	/**
	 * The fetch function to use when using this store in an endpoint.
	 */
	fetch?: LoadEvent['fetch']
}

export type ClientFetchParams<_Data extends GraphQLObject, _Input> = FetchGlobalParams<
	_Data,
	_Input
> & {
	/**
	 * An object containing all of the current info necessary for a
	 * client-side fetch. Must be called in component initialization with
	 * something like this: `const context = getHoudiniFetchContext()`
	 */
	context?: HoudiniFetchContext
}

export type QueryStoreFetchParams<_Data extends GraphQLObject, _Input> =
	| QueryStoreLoadParams<_Data, _Input>
	| ClientFetchParams<_Data, _Input>

export type QueryStoreLoadParams<_Data extends GraphQLObject, _Input> =
	| LoadEventFetchParams<_Data, _Input>
	| RequestEventFetchParams<_Data, _Input>
