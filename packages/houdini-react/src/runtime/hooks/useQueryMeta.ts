import { DocumentStore } from '$houdini/runtime/client'
import { extractPageInfo } from '$houdini/runtime/lib/pageInfo'
import { cursorHandlers, offsetHandlers } from '$houdini/runtime/lib/pagination'
import {
	type QueryArtifact,
	GraphQLObject,
	CursorHandlers,
	OffsetHandlers,
	PageInfo,
	FetchFn,
	QueryResult,
	DocumentArtifact,
	ArtifactKind,
} from '$houdini/runtime/lib/types'
import React from 'react'

import { useDocumentStore } from './useDocumentStore'

export function useQueryMeta<
	_Artifact extends QueryArtifact,
	_Data extends GraphQLObject,
	_Input extends Record<string, any>
>({
	artifact,
	observer,
	storeValue,
}: {
	artifact: DocumentArtifact
	observer: DocumentStore<_Data, _Input>
	storeValue: QueryResult<_Data, _Input>
}): QueryMeta<_Artifact, _Data, _Input> {
	// we need a document store for loading forward and backward
	const [forwardValue, forwardObserver] = useDocumentStore({ artifact })
	const [backwardValue, backwardObserver] = useDocumentStore({ artifact })

	return React.useMemo(() => {
		// only consider queries
		if (artifact.kind !== ArtifactKind.Query) {
			return {}
		}

		const fetchQuery: FetchFn<_Data, _Input> = ({ variables, policy, metadata } = {}) => {
			return observer.send({
				variables,
				policy,
				metadata,
			})
		}

		// if the artifact does not support pagination, we're done
		if (!artifact.refetch?.paginated) {
			return {
				fetch: fetchQuery,
				partial: storeValue.partial,
			}
		}

		// TODO: session
		const getSession = async () => ({} as App.Session)

		// if the artifact supports cursor pagination, then add the cursor handlers
		if (artifact.refetch.method === 'cursor') {
			const handlers = cursorHandlers({
				artifact,
				getState: () => storeValue.data,
				getVariables: () => storeValue.variables!,
				storeName: artifact.name,
				fetch: fetchQuery,
				fetchUpdate: async (args, updates) => {
					return observer.send({
						...args,
						cacheParams: {
							disableSubscriptions: true,
							applyUpdates: updates,
							...args?.cacheParams,
						},
					})
				},
				getSession,
			})

			return {
				partial: storeValue.partial,
				loadNext: handlers.loadNextPage,
				isLoadingNext: forwardValue.fetching,
				loadPrevious: handlers.loadPreviousPage,
				isLoadingPrevious: backwardValue.fetching,
				pageInfo: extractPageInfo(storeValue.data, artifact.refetch!.path),
			}
		}

		if (artifact.refetch.method === 'offset') {
			const handlers = offsetHandlers({
				artifact,
				getState: () => storeValue.data,
				getVariables: () => storeValue.variables!,
				storeName: artifact.name,
				fetch: fetchQuery,
				fetchUpdate: async (args, updates = ['append']) => {
					return observer.send({
						...args,
						cacheParams: {
							disableSubscriptions: true,
							applyUpdates: updates,
							...args?.cacheParams,
						},
					})
				},

				// TODO: session
				getSession: async () => ({} as App.Session),
			})

			return {
				partial: storeValue.partial,
				loadNext: handlers.loadNextPage,
				isLoadingNext: forwardValue.fetching,
			}
		}

		// we don't want to add anything
		return {}
	}, [
		artifact,
		observer,
		storeValue,
		forwardValue,
		forwardObserver,
		backwardValue,
		backwardObserver,
	]) as QueryMeta<_Artifact, _Data, _Input>
}

export type QueryMeta<
	_Artifact extends QueryArtifact,
	_Data extends GraphQLObject = GraphQLObject,
	_Input extends {} = []
> = {
	partial: boolean
	fetch: FetchFn<_Data, _Input>
} & RefetchHandlers<_Artifact, _Data, _Input>

type RefetchHandlers<_Artifact extends QueryArtifact, _Data extends GraphQLObject, _Input> =
	// we need to add different methods if the artifact supports cursor pagination
	_Artifact extends {
		refetch: { paginated: true; method: 'cursor' }
	}
		? {
				loadNext: CursorHandlers<_Data, _Input>['loadNextPage']
				isLoadingNext: boolean
				loadPrevious: CursorHandlers<_Data, _Input>['loadPreviousPage']
				isLoadingPrevious: boolean
				pageInfo: PageInfo
		  }
		: // offset pagination
		_Artifact extends { refetch: { paginated: true; method: 'offset' } }
		? {
				loadNext: OffsetHandlers<_Data, _Input>['loadNextPage']
				isLoadingNext: boolean
		  }
		: // the artifact does not support a known pagination method, don't add anything
		  {}
