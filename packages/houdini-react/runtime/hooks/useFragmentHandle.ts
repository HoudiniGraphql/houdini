import { extractPageInfo, cursorHandlers, offsetHandlers } from 'houdini/runtime'
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
	// get the fragment values
	const fragmentData = useFragment<_Data, _ReferenceType, _Input>(reference, document)

	// look at the fragment reference to get the variables
	const { variables } = fragmentReference<_Data, _Input, _ReferenceType>(reference, document)

	const client = useClient()
	const [session] = useSession()

	const [forwardPending, setForwardPending] = React.useState(false)
	const [backwardPending, setBackwardPending] = React.useState(false)

	// Stable cursor stacks for SinglePage pagination — must survive re-renders
	const previousCursorsRef = React.useRef<(string | null)[]>([])
	const nextCursorsRef = React.useRef<(string | null)[]>([])

	const refetchArtifact = document.refetchArtifact as QueryArtifact | undefined
	const refetchPath = refetchArtifact?.refetch?.path

	// Dedicated observer for pagination queries — separate from the fragment observer.
	// cursorHandlers derives entity variables (e.g. { id }) and artifact defaults
	// automatically via the type config, so no manual variable extraction is needed here.
	const paginationObserver = React.useMemo(() => {
		if (!refetchArtifact?.refetch?.paginated) return null
		return client.observe<_Data, _Input>({ artifact: refetchArtifact })
	}, [refetchArtifact?.name])

	// Subscribe to the pagination observer so React re-renders whenever a new page is fetched
	// or served from cache (CacheOrNetwork). The fragment store subscription only watches the
	// initial page's cache key; the observer is the live source of truth for SinglePage
	// pagination where each page lives at its own per-cursor cache key.
	const subscribeToObserver = React.useCallback(
		(onChange: () => void) => {
			if (!paginationObserver) return () => {}
			return paginationObserver.subscribe(onChange)
		},
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

	// Extract entity-level data from the pagination query response. For Node targetType
	// the response is { node: EntityData }; we take the first root field to handle any type.
	// Guard against partial cache hits (artifact has partial:true): only use the entity once the
	// paginated connection field at refetch.path[0] is actually present in the response.
	const paginationEntityData = React.useMemo<_Data | null>(() => {
		if (!paginationData || !refetchArtifact?.selection?.fields) return null
		const rootField = Object.keys(refetchArtifact.selection.fields)[0]
		if (!rootField) return null
		const entity = (paginationData as any)[rootField]
		if (!entity) return null
		const path = refetchArtifact.refetch?.path
		if (path && path.length > 0 && (entity as any)[path[0]] == null) {
			return null
		}
		return entity as _Data
	}, [paginationData, refetchArtifact])

	const isSinglePage = refetchArtifact?.refetch?.mode === 'SinglePage'

	// For SinglePage: use the pagination observer's entity data (each page has its own
	// cache key) once a page fetch has landed. For Infinite: always use fragmentData,
	// which reads accumulated pages from cache via the fragment's cache subscription.
	const displayData =
		isSinglePage && paginationEntityData !== null ? paginationEntityData : fragmentData

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
			return paginationObserver.send({ ...args, session })
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
				// Use the observer's own variable state so cursor history is preserved
				// across page navigations without manual tracking in the hook.
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

	return {
		...handle,
		variables,
		data: displayData,
	}
}
