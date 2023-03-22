import type { MutationArtifact, GraphQLObject, QueryResult } from '$houdini/runtime/lib/types'

import { useDocumentStore } from './useDocumentStore'

export type MutationHandler<_Result, _Input, _Optimistic extends GraphQLObject> = (args: {
	variables: _Input

	metadata?: App.Metadata
	fetch?: typeof globalThis.fetch
	optimisticResponse?: _Optimistic
}) => Promise<QueryResult<_Result, _Input>>

export function useMutation<
	_Result extends GraphQLObject,
	_Input extends {},
	_Optimistic extends GraphQLObject
>({
	artifact,
}: {
	artifact: MutationArtifact
}): [MutationHandler<_Result, _Input, _Optimistic>, boolean] {
	// build the live document we'll use to send values
	const [storeValue, observer] = useDocumentStore<_Result, _Input>({ artifact })

	// grab the pending state from the document store
	const pending = storeValue.fetching

	//  sending the mutation just means invoking the observer's send method
	const mutate: MutationHandler<_Result, _Input, _Optimistic> = ({
		metadata,
		fetch,
		variables,
		...mutationConfig
	}) =>
		observer.send({
			variables,
			metadata,
			// TODO: session/metadata
			session: {},
			stuff: {
				...mutationConfig,
			},
		})

	return [mutate, pending]
}
