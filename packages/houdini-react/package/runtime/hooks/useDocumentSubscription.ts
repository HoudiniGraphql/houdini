import type { GraphQLObject } from 'houdini'
import type { DocumentArtifact, GraphQLVariables, QueryResult } from 'houdini/src/lib/types'
import type { DocumentStore, SendParams } from 'houdini/src/runtime/client'

import { useSession } from '../routing/Router'
import useDeepCompareEffect from './useDeepCompareEffect'
import { useDocumentStore, type UseDocumentStoreParams } from './useDocumentStore'

export function useDocumentSubscription<
	_Artifact extends DocumentArtifact = DocumentArtifact,
	_Data extends GraphQLObject = GraphQLObject,
	_Input extends GraphQLVariables = GraphQLVariables
>({
	artifact,
	variables,
	send,
	disabled,
	...observeParams
}: UseDocumentStoreParams<_Artifact, _Data, _Input> & {
	variables: _Input
	disabled?: boolean
	send?: Partial<SendParams>
}): [QueryResult<_Data, _Input> & { parent?: string | null }, DocumentStore<_Data, _Input>] {
	const [storeValue, observer] = useDocumentStore<_Data, _Input>({
		artifact,
		...observeParams,
	})

	// grab the current session value
	const [session] = useSession()

	// whenever the variables change, we need to retrigger the query
	useDeepCompareEffect(() => {
		if (!disabled) {
			observer.send({
				variables,
				session,
				// TODO: metadata
				metadata: {},
				...send,
			})
		}

		return () => {
			if (!disabled) {
				observer.cleanup()
			}
		}
	}, [disabled, session, observer, variables ?? {}, send ?? {}])

	return [
		{
			parent: send?.stuff?.parentID,
			...storeValue,
		},
		observer,
	]
}
