import type {
	MutationArtifact,
	GraphQLObject,
	QueryResult,
	GraphQLVariables,
} from '$houdini/runtime/lib/types'

import { useSession } from '../routing/hooks'
import { useDocumentStore } from './useDocumentStore'

export type MutationHandler<_Result, _Input, _Optimistic extends GraphQLObject> = (args: {
	variables: _Input

	metadata?: App.Metadata
	fetch?: typeof globalThis.fetch
	optimisticResponse?: _Optimistic
	abortController?: AbortController
}) => Promise<QueryResult<_Result, _Input>>

export function useMutation<
	_Result extends GraphQLObject,
	_Input extends GraphQLVariables,
	_Optimistic extends GraphQLObject
>({
	artifact,
}: {
	artifact: MutationArtifact
}): [boolean, MutationHandler<_Result, _Input, _Optimistic>] {
	// build the live document we'll use to send values
	const [storeValue, observer] = useDocumentStore<_Result, _Input>({ artifact })

	// grab the pending state from the document store
	const pending = storeValue.fetching

	// grab the current session value
	const [session] = useSession()

	//  sending the mutation just means invoking the observer's send method
	const mutate: MutationHandler<_Result, _Input, _Optimistic> = async ({
		metadata,
		fetch,
		variables,
		abortController,
		...mutationConfig
	}) => {
		const result = await observer.send({
			variables,
			metadata,
			session,
			abortController,
			stuff: {
				...mutationConfig,
			},
		})

		if (result.errors && result.errors?.length > 0) {
			const err = new RuntimeGraphQLError(
				result.errors.map((error) => error.message).join('. ')
			)
			err.raw = result.errors
			throw err
		}
	}

	return [pending, mutate]
}

export class RuntimeGraphQLError extends Error {
	raw: QueryResult['errors'] = []
}
