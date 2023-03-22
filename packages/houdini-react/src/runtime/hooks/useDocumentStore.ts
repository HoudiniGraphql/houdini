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
	DocumentStore<_Data, _Input>
] {
	const client = useHoudiniClient()

	// hold onto an observer we'll use
	const { current: observer } = React.useRef(
		client.observe<_Data, _Input>({
			artifact,
			...observeParams,
		})
	)

	// get a safe reference to the cache
	const storeValue = React.useSyncExternalStore(
		observer.subscribe.bind(observer),
		() => observer.state
	)

	return [storeValue, observer]
}
