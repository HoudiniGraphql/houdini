import {
	extractPageInfo,
	cursorHandlers,
	offsetHandlers,
	getCurrentConfig,
	entityRefetchVariables,
} from 'houdini/runtime'
import type {
	GraphQLObject,
	FragmentArtifact,
	QueryArtifact,
	GraphQLVariables,
	FetchFn,
} from 'houdini/runtime'
import * as React from 'react'

import { useClient, useSession } from '../routing/Router.js'
import type { DocumentHandle } from './useDocumentHandle.js'
import { fragmentReference, useFragment } from './useFragment.js'

// useFragmentHandle is just like useFragment except it also returns an imperative handle
// that users can use to interact with the fragment
export function useFragmentHandle<
	_Artifact extends FragmentArtifact,
	_Data extends GraphQLObject,
	_ReferenceType extends {},
	_PaginationArtifact extends QueryArtifact,
	_Input extends GraphQLVariables = GraphQLVariables,
>(
	reference: _Data | { ' $fragments': _ReferenceType } | null,
	document: { artifact: FragmentArtifact; refetchArtifact?: QueryArtifact }
): any {
	const fragmentData = useFragment<_Data, _ReferenceType, _Input>(reference, document)
	const { variables } = fragmentReference<_Data, _Input, _ReferenceType>(reference, document)

	const client = useClient()
	const [session] = useSession()

	const [forwardPending, setForwardPending] = React.useState(false)
	const [backwardPending, setBackwardPending] = React.useState(false)

	const previousCursorsRef = React.useRef<(string | null)[]>([])
	const nextCursorsRef = React.useRef<(string | null)[]>([])

	const refetchArtifact = document.refetchArtifact as QueryArtifact | undefined
	const refetchPath = refetchArtifact?.refetch?.path

	const paginationObserver = React.useMemo(() => {
		if (!refetchArtifact?.refetch?.paginated) return null
		return client.observe<_Data, _Input>({ artifact: refetchArtifact })
	}, [refetchArtifact?.name])

	const isSinglePage = refetchArtifact?.refetch?.mode === 'SinglePage'

	// Subscribe to the pagination observer so the component re-renders when a new page lands.
	// For SinglePage we pass disablePartial so partial cache hits (entity found but connection
	// not yet fetched) are never resolved back to the observer — we go straight to the network
	// and update the observer only once we have a complete page.
	const subscribeToObserver = React.useCallback(
		(fn: () => void) => paginationObserver?.subscribe(() => fn()) ?? (() => {}),
		[paginationObserver]
	)
	const getObserverSnapshot = React.useCallback(
		() => paginationObserver?.state.data ?? null,
		[paginationObserver]
	)
	const paginationData = React.useSyncExternalStore(
		subscribeToObserver,
		getObserverSnapshot,
		getObserverSnapshot
	)

	const paginationEntityData = React.useMemo<_Data | null>(() => {
		if (!paginationData || !refetchArtifact?.selection?.fields) return null
		const rootField = Object.keys(refetchArtifact.selection.fields)[0]
		if (!rootField) return null
		return (paginationData as any)[rootField] ?? null
	}, [paginationData, refetchArtifact])

	// @refetchable fragments embed the fragment in a query keyed by id (paginated: false).
	// We observe that query so refetch() can swap in fresh data computed with new argument
	// values, just like SinglePage pagination swaps in the latest page.
	const isRefetchable = !!refetchArtifact?.refetch && !refetchArtifact.refetch.paginated

	const refetchObserver = React.useMemo(() => {
		if (!isRefetchable || !refetchArtifact) return null
		return client.observe<_Data, _Input>({ artifact: refetchArtifact })
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [refetchArtifact?.name, isRefetchable])

	const subscribeToRefetch = React.useCallback(
		(fn: () => void) => refetchObserver?.subscribe(() => fn()) ?? (() => {}),
		[refetchObserver]
	)
	const getRefetchSnapshot = React.useCallback(
		() => refetchObserver?.state.data ?? null,
		[refetchObserver]
	)
	const refetchData = React.useSyncExternalStore(
		subscribeToRefetch,
		getRefetchSnapshot,
		getRefetchSnapshot
	)

	const refetchEntityData = React.useMemo<_Data | null>(() => {
		if (!refetchData || !refetchArtifact?.selection?.fields) return null
		const rootField = Object.keys(refetchArtifact.selection.fields)[0]
		if (!rootField) return null
		return (refetchData as any)[rootField] ?? null
	}, [refetchData, refetchArtifact])

	const displayData =
		isSinglePage && paginationEntityData !== null
			? paginationEntityData
			: isRefetchable && refetchEntityData !== null
			? refetchEntityData
			: fragmentData

	const wrapLoad = <_Result>(
		setLoading: (val: boolean) => void,
		fn: (value: any) => Promise<_Result>
	) => {
		return async (value: any) => {
			setLoading(true)
			let err: Error | null = null
			let result: _Result | null = null
			try {
				result = await fn(value)
			} catch (e) {
				err = e as Error
			}
			setLoading(false)
			if (err && err.name !== 'AbortError') throw err
			return result
		}
	}

	const handle = React.useMemo(() => {
		if (!refetchArtifact?.refetch?.paginated || !paginationObserver) return null

		const fetchFn: FetchFn<_Data, _Input> = (args) => {
			return paginationObserver.send({
				...args,
				session,
				stuff: { silenceLoading: true },
				cacheParams: {
					disableSubscriptions: true,
					// Suppress partial cache hits so an in-flight forward navigation never
					// briefly resolves with an entity that is missing its connection field.
					// Full cache hits (partial: false) still resolve, so backward navigation
					// continues to be served instantly from cache.
					disablePartial: true,
				},
			})
		}

		const fetchUpdate = (args: any, updates: string[]) => {
			return paginationObserver.send({
				...args,
				cacheParams: {
					...args?.cacheParams,
					disableSubscriptions: true,
					applyUpdates: updates,
				},
				session,
			})
		}

		if (refetchArtifact.refetch!.method === 'cursor') {
			const handlers = cursorHandlers<_Data, _Input>({
				artifact: refetchArtifact,
				getState: () => displayData as _Data | null,
				getVariables: () =>
					(paginationObserver.state.variables ?? variables) as NonNullable<_Input>,
				fetch: fetchFn,
				fetchUpdate,
				getSession: async () => session,
				previousCursors: previousCursorsRef.current,
				nextCursors: nextCursorsRef.current,
			})

			return {
				loadNext: wrapLoad(setForwardPending, handlers.loadNextPage),
				loadNextPending: forwardPending,
				loadPrevious: wrapLoad(setBackwardPending, handlers.loadPreviousPage),
				loadPreviousPending: backwardPending,
				pageInfo: refetchPath
					? extractPageInfo(displayData as GraphQLObject, refetchPath)
					: null,
			}
		}

		if (refetchArtifact.refetch!.method === 'offset') {
			const handlers = offsetHandlers({
				artifact: refetchArtifact,
				getState: () => displayData as _Data | null,
				getVariables: () =>
					(paginationObserver.state.variables ?? variables) as NonNullable<_Input>,
				storeName: refetchArtifact.name,
				fetch: fetchFn,
				fetchUpdate: async (args: any, updates = ['append']) =>
					fetchUpdate(args, updates) as any,
				getSession: async () => session,
			})

			return {
				loadNext: wrapLoad(setForwardPending, handlers.loadNextPage),
				loadNextPending: forwardPending,
			}
		}

		return null
	}, [refetchArtifact, paginationObserver, displayData, session, forwardPending, backwardPending])

	// re-run the embedded query with new argument values. the entity's id is derived from
	// the fragment data (the parent reference), which always carries the visible id. we must
	// NOT derive it from displayData: after a refetch that becomes the embedded query result,
	// which masks the entity's id out of its selection, so reading it back would yield
	// `id: undefined` and clobber the real id on a second refetch.
	const refetch = React.useMemo(() => {
		if (!isRefetchable || !refetchObserver || !refetchArtifact) return undefined
		return (newVariables?: _Input) => {
			const idVariables = entityRefetchVariables(
				getCurrentConfig(),
				refetchArtifact.refetch?.targetType,
				fragmentData as Record<string, any> | null
			)
			return refetchObserver.send({
				variables: {
					...(refetchObserver.state.variables ?? variables),
					...idVariables,
					...newVariables,
				} as _Input,
				// suppress loading-state placeholder data during the transition so the
				// currently displayed value stays put until the fresh result arrives
				stuff: { silenceLoading: true },
				cacheParams: { disableSubscriptions: true, disablePartial: true },
				session,
			})
		}
	}, [isRefetchable, refetchObserver, refetchArtifact, fragmentData, variables, session])

	return {
		...handle,
		variables,
		data: displayData,
		refetch,
	}
}
