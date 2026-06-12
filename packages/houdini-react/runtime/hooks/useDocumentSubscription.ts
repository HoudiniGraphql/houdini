import type {
	DocumentArtifact,
	GraphQLVariables,
	QueryResult,
	GraphQLObject,
} from 'houdini/runtime'
import type { DocumentStore, SendParams } from 'houdini/runtime/client'

import { useSession } from '../routing/Router.js'
import useDeepCompareEffect from './useDeepCompareEffect.js'
import { useDocumentStore, type UseDocumentStoreParams } from './useDocumentStore.js'

export function useDocumentSubscription<
	_Artifact extends DocumentArtifact = DocumentArtifact,
	_Data extends GraphQLObject = GraphQLObject,
	_Input extends GraphQLVariables = GraphQLVariables,
>({
	artifact,
	variables,
	send,
	initialState,
	disabled,
	...observeParams
}: UseDocumentStoreParams<_Artifact, _Data, _Input> & {
	variables: _Input
	disabled?: boolean
	send?: Partial<Omit<SendParams, 'initialState'>>
	// passed directly to observer.send() and intentionally excluded from the dep
	// comparison — it changes in lockstep with send.stuff.parentID so including it
	// would add a large data object to the deep-equals check for no benefit
	initialState?: SendParams['initialState']
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
				initialState,
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
