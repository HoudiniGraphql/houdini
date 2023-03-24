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

export function useDocumentHandle<
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
}): DocumentHandle<_Artifact, _Data, _Input> {
	const [forwardPending, setForwardPending] = React.useState(false)
	const [backwardPending, setBackwardPending] = React.useState(false)
	const [fetchPending, setFetchPending] = React.useState(false)

	// @ts-expect-error: avoiding an as DocumentHandle<_Artifact, _Data, _Input>
	return React.useMemo<DocumentHandle<_Artifact, _Data, _Input>>(() => {
		const wrapLoad = <_Result>(
			setLoading: (val: boolean) => void,
			fn: (value: any) => Promise<_Result>
		) => {
			return async (value: any) => {
				setLoading(true)
				const result = await fn(value)
				setLoading(false)
				return result
			}
		}

		const fetchQuery = wrapLoad(setFetchPending, (args) => {
			return observer.send({
				...args,
				stuff: {
					silenceLoading: true,
				},
			})
		})

		// only consider paginated queries
		if (artifact.kind !== ArtifactKind.Query || !artifact.refetch?.paginated) {
			return {
				data: storeValue.data,
				loading: fetchPending,
				refetch: fetchQuery,
				partial: storeValue.partial,
			}
		}

		// TODO: session
		const getSession = async () => ({} as App.Session)

		// if the artifact supports cursor pagination, then add the cursor handlers
		if (artifact.refetch.method === 'cursor') {
			const handlers = cursorHandlers<_Data, _Input>({
				artifact,
				getState: () => storeValue.data,
				getVariables: () => storeValue.variables!,
				storeName: artifact.name,
				fetch: fetchQuery,
				fetchUpdate: (args, updates) => {
					return observer.send({
						...args,
						stuff: {
							// silenceLoading: true,
							...args.stuff,
						},
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
				data: storeValue.data,
				loading: fetchPending,
				refetch: handlers.fetch,
				partial: storeValue.partial,
				loadNext: wrapLoad(setForwardPending, handlers.loadNextPage),
				isLoadingNext: forwardPending,
				loadPrevious: wrapLoad(setBackwardPending, handlers.loadPreviousPage),
				isLoadingPrevious: backwardPending,
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
						stuff: {
							// silenceLoading: true,
						},
					})
				},

				// TODO: session
				getSession: async () => ({} as App.Session),
			})

			return {
				data: storeValue.data,
				loading: fetchPending,
				refetch: handlers.fetch,
				partial: storeValue.partial,
				loadNext: wrapLoad(setForwardPending, handlers.loadNextPage),
				isLoadingNext: forwardPending,
			}
		}

		// we don't want to add anything
		return {
			data: storeValue.data,
			refetch: fetchQuery,
			partial: storeValue.partial,
		}
	}, [artifact, observer, storeValue, true, true])
}

export type DocumentHandle<
	_Artifact extends QueryArtifact,
	_Data extends GraphQLObject = GraphQLObject,
	_Input extends {} = []
> = {
	data: _Data
	loading: boolean
	partial: boolean
	refetch: FetchFn<_Data, _Input>
	variables: _Input
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
