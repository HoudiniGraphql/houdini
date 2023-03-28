import type { DocumentArtifact, QueryResult } from '$houdini/lib/types'
import type { DocumentStore, ObserveParams } from '$houdini/runtime/client'
import { GraphQLObject } from 'houdini'
import * as React from 'react'

import { useHoudiniClient } from './useHoudiniClient'

export type UseDocumentStoreParams<
	_Artifact extends DocumentArtifact,
	_Data extends GraphQLObject
> = {
	artifact: _Artifact
} & Partial<ObserveParams<_Data>>

export function useDocumentStore<
	_Data extends GraphQLObject = GraphQLObject,
	_Input extends {} = {},
	_Artifact extends DocumentArtifact = DocumentArtifact
>({
	artifact,
	...observeParams
}: UseDocumentStoreParams<_Artifact, _Data>): [
	QueryResult<_Data, _Input>,
	DocumentStore<_Data, _Input>,
	(store: DocumentStore<_Data, _Input>) => void
] {
	const client = useHoudiniClient()

	// hold onto an observer we'll use
	let [observer, setObserver] = React.useState(() =>
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
				fn()
			})
		},
		[observer]
	)

	// get a safe reference to the cache
	const storeValue = React.useSyncExternalStore(subscribe, () => box.current)

	return [storeValue!, observer, setObserver]
}
