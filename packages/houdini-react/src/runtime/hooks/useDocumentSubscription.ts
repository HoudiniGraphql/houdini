import type { DocumentArtifact, QueryResult } from '$houdini/lib/types'
import type { DocumentStore, SendParams } from '$houdini/runtime/client'
import type { GraphQLObject } from 'houdini'

import useDeepCompareEffect from './useDeepCompareEffect'
import { useDocumentStore, type UseDocumentStoreParams } from './useDocumentStore'

export function useDocumentSubscription<
	_Artifact extends DocumentArtifact = DocumentArtifact,
	_Data extends GraphQLObject = GraphQLObject,
	_Input extends {} = {}
>({
	artifact,
	variables,
	send,
	...observeParams
}: UseDocumentStoreParams<_Artifact, _Data> & {
	variables: _Input
	send?: Partial<SendParams>
}): [
	QueryResult<_Data, _Input> & { parent?: string | null },
	DocumentStore<_Data, _Input>,
	(store: DocumentStore<_Data, _Input>) => void
] {
	const [storeValue, observer, setObserver] = useDocumentStore<_Data, _Input>({
		artifact,
		...observeParams,
	})

	// whenever the variables change, we need to retrigger the query
	useDeepCompareEffect(() => {
		observer.send({
			variables,
			// TODO: session/metadata
			session: {},
			metadata: {},
			...send,
		})
		return () => {
			observer.cleanup()
		}
	}, [observer, variables ?? {}, send ?? {}])

	return [
		{
			parent: send?.stuff?.parentID,
			...storeValue,
		},
		observer,
		setObserver,
	]
}
