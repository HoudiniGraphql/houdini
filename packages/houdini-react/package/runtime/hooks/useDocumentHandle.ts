import { ArtifactKind } from '$houdini/runtime/lib/types'
import type {
	GraphQLObject,
	GraphQLVariables,
	CursorHandlers,
	OffsetHandlers,
	PageInfo,
	FetchFn,
	QueryResult,
	DocumentArtifact,
	QueryArtifact,
} from '$houdini/runtime/lib/types'
import type { DocumentStore } from 'houdini/src/runtime/client'
import { extractPageInfo } from 'houdini/src/runtime/lib/pageInfo'
import { cursorHandlers, offsetHandlers } from 'houdini/src/runtime/lib/pagination'
import React from 'react'

import { useClient, useLocation, useSession } from '../routing/Router'

export function useDocumentHandle<
	_Artifact extends QueryArtifact,
	_Data extends GraphQLObject,
	_Input extends GraphQLVariables
>({
	artifact,
	observer,
	storeValue,
}: {
	artifact: DocumentArtifact
	observer: DocumentStore<_Data, _Input>
	storeValue: QueryResult<_Data, _Input>
}): DocumentHandle<_Artifact, _Data, _Input> & { fetch: FetchFn<_Data, _Input> } {
	const [forwardPending, setForwardPending] = React.useState(false)
	const [backwardPending, setBackwardPending] = React.useState(false)
	const location = useLocation()

	// grab the current session value
	const [session] = useSession()

	// we want to use a separate observer for pagination queries
	const client = useClient()
	const paginationObserver = React.useMemo(() => {
		// if the artifact doesn't support pagination, don't do anything
		if (!artifact.refetch?.paginated) {
			return null
		}

		return client.observe<_Data, _Input>({ artifact })
	}, [artifact.name])

	// @ts-expect-error: avoiding an as DocumentHandle<_Artifact, _Data, _Input>
	return React.useMemo<DocumentHandle<_Artifact, _Data, _Input>>(() => {
		const wrapLoad = <_Result>(
			setLoading: (val: boolean) => void,
			fn: (value: any) => Promise<_Result>
		) => {
			return async (value: any) => {
				setLoading(true)
				let result: _Result | null = null
				let err: Error | null = null
				try {
					result = await fn(value)
				} catch (e) {
					err = e as Error
				}
				setLoading(false)
				// ignore abort errors when loading pages
				if (err && err.name !== 'AbortError') {
					throw err
				}

				// we're done
				return result || observer.state
			}
		}

		// add the session value to the
		const fetchQuery: FetchFn<_Data, _Input> = (args) => {
			// before we send the query, we need to figure out which variables are
			// actually useful for this document
			const usedVariables = Object.fromEntries(
				Object.keys(observer.artifact.input?.fields ?? {}).reduce<[string, any][]>(
					(entries, fieldName) => {
						// if the field is not a url parameter, skip it
						if (!(fieldName in location.params)) {
							return entries
						}

						return [...entries, [fieldName, location.params[fieldName]]]
					},
					[]
				)
			)

			return observer.send({
				...args,
				variables: {
					...usedVariables,
					...args?.variables,
				},
				session,
			})
		}

		// only consider paginated queries
		if (artifact.kind !== ArtifactKind.Query || !artifact.refetch?.paginated) {
			return {
				artifact,
				data: storeValue.data,
				variables: storeValue.variables,
				fetch: fetchQuery,
				partial: storeValue.partial,
			}
		}

		// if the artifact supports cursor pagination, then add the cursor handlers
		if (artifact.refetch.method === 'cursor') {
			const handlers = cursorHandlers<_Data, _Input>({
				artifact,
				getState: () => storeValue.data,
				getVariables: () => storeValue.variables!,
				fetch: fetchQuery,
				fetchUpdate: (args, updates) => {
					return paginationObserver!.send({
						...args,
						cacheParams: {
							...args?.cacheParams,
							disableSubscriptions: true,
							applyUpdates: updates,
						},
						session,
					})
				},
				getSession: async () => session,
			})

			return {
				artifact,
				data: storeValue.data,
				variables: storeValue.variables,
				fetch: handlers.fetch,
				partial: storeValue.partial,
				loadNext: wrapLoad(setForwardPending, handlers.loadNextPage),
				loadNextPending: forwardPending,
				loadPrevious: wrapLoad(setBackwardPending, handlers.loadPreviousPage),
				loadPreviousPending: backwardPending,
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
					return paginationObserver!.send({
						...args,
						cacheParams: {
							disableSubscriptions: true,
							applyUpdates: updates,
							...args?.cacheParams,
						},
					})
				},
				getSession: async () => session,
			})

			return {
				artifact,
				data: storeValue.data,
				variables: storeValue.variables,
				fetch: handlers.fetch,
				partial: storeValue.partial,
				loadNext: wrapLoad(setForwardPending, handlers.loadNextPage),
				loadNextPending: forwardPending,
			}
		}

		// we don't want to add anything
		return {
			artifact,
			data: storeValue.data,
			variables: storeValue.variables,
			fetch: fetchQuery,
			refetch: fetchQuery,
			partial: storeValue.partial,
		}
	}, [artifact, observer, session, storeValue])
}

export type DocumentHandle<
	_Artifact extends QueryArtifact,
	_Data extends GraphQLObject = GraphQLObject,
	_Input extends GraphQLVariables = GraphQLVariables
> = {
	data: _Data
	partial: boolean
	fetch: FetchFn<_Data, Partial<_Input>>
	variables: _Input
} & RefetchHandlers<_Artifact, _Data, _Input>

type RefetchHandlers<_Artifact extends QueryArtifact, _Data extends GraphQLObject, _Input> =
	// we need to add different methods if the artifact supports cursor pagination
	_Artifact extends {
		refetch: { paginated: true; method: 'cursor' }
	}
		? {
				loadNext: CursorHandlers<_Data, _Input>['loadNextPage']
				loadNextPending: boolean
				loadPrevious: CursorHandlers<_Data, _Input>['loadPreviousPage']
				loadPreviousPending: boolean
				pageInfo: PageInfo
		  }
		: // offset pagination
		_Artifact extends { refetch: { paginated: true; method: 'offset' } }
		? {
				loadNext: OffsetHandlers<_Data, _Input>['loadNextPage']
				loadNextPending: boolean
		  }
		: // the artifact does not support a known pagination method, don't add anything
		  {}
