import { DocumentStore } from '$houdini/runtime'
import { cursorHandlers, offsetHandlers } from '$houdini/runtime/lib/pagination'
import {
	type QueryArtifact,
	GraphQLObject,
	CursorHandlers,
	OffsetHandlers,
	PageInfo,
	FetchFn,
	QueryResult,
} from '$houdini/runtime/lib/types'
import React from 'react'

export function useQueryMeta<
	_Artifact extends QueryArtifact,
	_Data extends GraphQLObject,
	_Input extends Record<string, any>
>({
	artifact,
	observer,
	storeValue,
}: {
	artifact: QueryArtifact
	observer: DocumentStore<_Data, _Input>
	storeValue: QueryResult<_Data, _Input>
}) {
	return React.useMemo<QueryMeta<_Artifact, _Data, _Input>>(() => {
		const fetchQuery: FetchFn<_Data, _Input> = ({ variables, policy, metadata } = {}) => {
			return observer.send({
				variables,
				policy,
				metadata,
			})
		}

		// build up the utility object
		const partial = {
			fetch: fetchQuery,
			partial: storeValue.partial,
		} as QueryMeta<_Artifact, _Data, _Input>

		// if the artifact does not support pagination, we're done
		if (!artifact.refetch?.paginated) {
			return partial
		}

		// if the artifact supports cursor pagination, then add the cursor handlers
		if (artifact.refetch.method === 'cursor') {
			Object.assign(
				partial,
				cursorHandlers({
					artifact,
					getState: () => storeValue.data,
					getVariables: () => storeValue.variables!,
					storeName: artifact.name,
					fetch: fetchQuery,
					fetchUpdate: async (args, updates) => {
						return observer.send({
							...args,
							cacheParams: {
								applyUpdates: updates,
								...args?.cacheParams,
							},
						})
					},

					// TODO: session
					getSession: async () => ({} as App.Session),
				})
			)
		}

		if (artifact.refetch.method === 'offset') {
			Object.assign(
				partial,
				offsetHandlers({
					artifact,
					getState: () => storeValue.data,
					getVariables: () => storeValue.variables!,
					storeName: artifact.name,
					fetch: fetchQuery,
					fetchUpdate: async (args, updates = ['append']) => {
						return observer.send({
							...args,
							cacheParams: {
								applyUpdates: updates,
								...args?.cacheParams,
							},
						})
					},

					// TODO: session
					getSession: async () => ({} as App.Session),
				})
			)
		}

		return partial
	}, [artifact, observer, storeValue])
}

export type QueryMeta<
	_Artifact extends QueryArtifact,
	_Data extends GraphQLObject = GraphQLObject,
	_Input extends {} = []
> = {
	partial: boolean
	fetch: FetchFn<_Data, _Input>
} & PaginationHandlers<_Artifact, _Data, _Input>

type PaginationHandlers<_Artifact extends QueryArtifact, _Data extends GraphQLObject, _Input> =
	// we need to add different methods if the artifact supports cursor pagination
	_Artifact extends {
		refetch: { paginated: true; method: 'cursor' }
	}
		? CursorHandlers<_Data, _Input> & { pageInfo: PageInfo }
		: // offset pagination
		_Artifact extends { refetch: { paginated: true; method: 'offset' } }
		? OffsetHandlers<_Data, _Input>
		: // the artifact does not support a known pagination method, don't add anything
		  {}
