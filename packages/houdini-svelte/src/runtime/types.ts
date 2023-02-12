import type {
	FetchQueryResult,
	CompiledFragmentKind,
	QueryResult,
	GraphQLObject,
} from '$houdini/runtime/lib/types'
import type { LoadEvent } from '@sveltejs/kit'
import type { Readable, Writable } from 'svelte/store'

import { QueryStoreFetchParams } from './stores'
import { PageInfo } from './stores/pagination/pageInfo'

export type QueryInputs<_Data> = FetchQueryResult<_Data> & { variables: { [key: string]: any } }

export type VariableFunction<_Params extends Record<string, string>, _Input> = (
	event: LoadEvent<_Params>
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

export type FragmentStoreInstance<_Data> = Readable<_Data> & {
	kind: typeof CompiledFragmentKind
	update: Writable<_Data>['set']
}

export type CursorFragmentStoreInstance<_Data extends GraphQLObject, _Input> = {
	kind: typeof CompiledFragmentKind
	data: Readable<_Data>
	subscribe: Readable<QueryResult<_Data, _Input>>['subscribe']
	fetching: Readable<boolean>
} & CursorHandlers<_Data, _Input>

export type OffsetFragmentStoreInstance<_Data extends GraphQLObject, _Input> = {
	kind: typeof CompiledFragmentKind
	data: Readable<_Data | null>
	subscribe: Readable<QueryResult<_Data, _Input>>['subscribe']
	fetching: Readable<boolean>
} & OffsetHandlers<_Data, _Input>

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

export type OffsetHandlers<_Data extends GraphQLObject, _Input> = {
	loadNextPage: (args?: {
		limit?: number
		offset?: number
		metadata?: {}
		fetch?: typeof globalThis.fetch
	}) => Promise<void>
	fetch(
		args?: QueryStoreFetchParams<_Data, _Input> | undefined
	): Promise<QueryResult<_Data, _Input>>
}
