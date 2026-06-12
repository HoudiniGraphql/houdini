import type {
	DocumentArtifact,
	GraphQLVariables,
	QueryResult,
	GraphQLObject,
} from 'houdini/runtime'
import type { DocumentStore, ObserveParams } from 'houdini/runtime/client'
import * as React from 'react'

import { useClient } from '../routing/index.js'
import { useIsMountedRef } from './useIsMounted.js'
import { recycleNodesInto } from './recycleNodesInto.js'

export type UseDocumentStoreParams<
	_Artifact extends DocumentArtifact,
	_Data extends GraphQLObject,
	_Input extends GraphQLVariables,
> = {
	artifact: _Artifact
	observer?: DocumentStore<_Data, _Input>
	// Optional synchronous seed for box.current. When provided, box.current is updated
	// during render so useSyncExternalStore's snapshot is immediately correct (e.g. on
	// fragment parent change). Must be memoized by the caller — tracked by reference.
	initialState?: QueryResult<_Data, _Input>
} & Partial<ObserveParams<_Data, DocumentArtifact, _Input>>

export function useDocumentStore<
	_Data extends GraphQLObject = GraphQLObject,
	_Input extends GraphQLVariables = GraphQLVariables,
	_Artifact extends DocumentArtifact = DocumentArtifact,
>({
	artifact,
	observer: obs,
	initialState,
	...observeParams
}: UseDocumentStoreParams<_Artifact, _Data, _Input>): [
	QueryResult<_Data, _Input>,
	DocumentStore<_Data, _Input>,
] {
	const client = useClient()
	const isMountedRef = useIsMountedRef()

	// hold onto an observer we'll use
	const [observer, setObserver] = React.useState(
		() =>
			obs ??
			client.observe<_Data, _Input>({
				artifact,
				...observeParams,
			})
	)

	const box = React.useRef(observer.state)

	// if the observer changes, we need to track the new one
	if (obs && obs !== observer) {
		box.current = obs.state
		setObserver(obs)
	}

	// Relay-style synchronous seeding: when initialState changes (i.e., the fragment
	// parent changed), update box.current immediately during this render so
	// useSyncExternalStore's getSnapshot returns the correct data without waiting for
	// the subscription effect to fire. Tracked by reference — if provided, callers
	// must memoize initialState to avoid spurious reseeds on every render.
	const prevInitialStateRef = React.useRef<QueryResult<_Data, _Input> | undefined>(undefined)
	if (initialState !== undefined && initialState !== prevInitialStateRef.current) {
		prevInitialStateRef.current = initialState
		box.current = initialState
	}

	// the function that registers a new subscription for the observer
	const subscribe: any = React.useCallback(
		(fn: () => void) => {
			return observer.subscribe((val) => {
				const prev = box.current
				// Preserve object identity for unchanged subtrees so React.memo on
				// fragment components can bail out when their data wasn't touched.
				const stableData = recycleNodesInto(prev?.data, val.data)
				const next =
					stableData === val.data ? val : { ...val, data: stableData }

				// Skip the re-render entirely if the new state is semantically identical
				// to what React already has (e.g. an idempotent cache write).
				if (
					next === prev ||
					(stableData === prev?.data &&
						val.fetching === prev?.fetching &&
						val.errors === prev?.errors &&
						val.source === prev?.source &&
						val.stale === prev?.stale)
				) {
					return
				}

				box.current = next
				if (isMountedRef.current) {
					fn()
				}
			})
		},
		[observer, isMountedRef.current]
	)

	// get a safe reference to the cache
	const storeValue = React.useSyncExternalStore(
		subscribe,
		() => box.current,
		() => box.current
	)

	return [storeValue!, observer]
}
