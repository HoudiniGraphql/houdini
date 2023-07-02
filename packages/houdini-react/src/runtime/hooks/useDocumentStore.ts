import type { DocumentArtifact, GraphQLVariables, QueryResult } from '$houdini/lib/types'
import type { DocumentStore, ObserveParams } from '$houdini/runtime/client'
import type { GraphQLObject } from 'houdini'
import * as React from 'react'

import { useClient } from '../routing'
import { useIsMountedRef } from './useIsMounted'

export type UseDocumentStoreParams<
	_Artifact extends DocumentArtifact,
	_Data extends GraphQLObject,
	_Input extends GraphQLVariables
> = {
	artifact: _Artifact
	observer?: DocumentStore<_Data, _Input>
} & Partial<ObserveParams<_Data, DocumentArtifact, _Input>>

export function useDocumentStore<
	_Data extends GraphQLObject = GraphQLObject,
	_Input extends GraphQLVariables = GraphQLVariables,
	_Artifact extends DocumentArtifact = DocumentArtifact
>({
	artifact,
	observer: obs,
	...observeParams
}: UseDocumentStoreParams<_Artifact, _Data, _Input>): [
	QueryResult<_Data, _Input>,
	DocumentStore<_Data, _Input>,
	(store: DocumentStore<_Data, _Input>) => void
] {
	const client = useClient()
	const isMountedRef = useIsMountedRef()

	// hold onto an observer we'll use
	let [observer, setObserver] = React.useState(
		() =>
			obs ??
			client.observe<_Data, _Input>({
				artifact,
				...observeParams,
			})
	)

	const box = React.useRef(observer.state)

	const subscribe: any = React.useCallback(
		(fn: () => void) => {
			return observer.subscribe((val) => {
				box.current = val
				if (isMountedRef.current) {
					fn()
				}
			})
		},
		[observer]
	)

	// get a safe reference to the cache
	const storeValue = React.useSyncExternalStore(
		subscribe,
		() => box.current,
		() => box.current
	)

	return [storeValue!, observer, setObserver]
}
