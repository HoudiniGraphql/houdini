import type { QueryResult } from '$houdini/lib/types'
import type { DocumentStore, SendParams } from '$houdini/runtime/client'
import { GraphQLObject } from 'houdini'

import useDeepCompareEffect from './useDeepCompareEffect'
import { useDocumentStore, type UseDocumentStoreParams } from './useDocumentStore'

export function useLiveDocument<
	_Data extends GraphQLObject = GraphQLObject,
	_Input extends {} = {}
>({
	artifact,
	variables,
	send,
	...observeParams
}: UseDocumentStoreParams<_Data> & {
	variables: _Input
	send?: Partial<SendParams>
}): [QueryResult<_Data, _Input>, DocumentStore<_Data, _Input>] {
	const [storeValue, observer] = useDocumentStore<_Data, _Input>({ artifact, ...observeParams })

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
	}, [variables ?? {}, send ?? {}])

	return [storeValue, observer]
}
