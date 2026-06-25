import type {
	MutationArtifact,
	GraphQLObject,
	QueryResult,
	GraphQLVariables,
} from 'houdini/runtime'

import { useSession } from '../routing/Router.js'
import { useDocumentStore } from './useDocumentStore.js'

type MutationConfig<_Optimistic extends GraphQLObject> = {
	metadata?: App.Metadata
	fetch?: typeof globalThis.fetch
	optimisticResponse?: _Optimistic
	abortController?: AbortController
}

// When the mutation has no variables its $input is `null | undefined`, so requiring a
// `variables` key would force callers to write `{ variables: undefined }`. In that case the
// whole argument is optional and the handler can be invoked as `mutate()`; otherwise
// `variables` is required.
export type MutationHandler<_Result, _Input, _Optimistic extends GraphQLObject> = [undefined] extends [
	_Input,
]
	? (args?: { variables?: _Input } & MutationConfig<_Optimistic>) => Promise<_Result>
	: (args: { variables: _Input } & MutationConfig<_Optimistic>) => Promise<_Result>

export function useMutation<
	_Result extends GraphQLObject,
	_Input extends GraphQLVariables,
	_Optimistic extends GraphQLObject,
>({
	artifact,
}: {
	artifact: MutationArtifact
}): [MutationHandler<_Result, _Input, _Optimistic>, boolean] {
	// build the live document we'll use to send values
	const [storeValue, observer] = useDocumentStore<_Result, _Input>({ artifact })

	// grab the pending state from the document store
	const pending = storeValue.fetching

	// grab the current session value
	const [session] = useSession()

	//  sending the mutation just means invoking the observer's send method
	const mutate = async (
		args: { variables?: _Input } & MutationConfig<_Optimistic> = {}
	): Promise<_Result> => {
		const { metadata, fetch, variables, abortController, ...mutationConfig } = args
		const result = await observer.send({
			variables,
			metadata,
			session,
			abortController,
			stuff: {
				...mutationConfig,
			},
		})

		if (result.errors && result.errors.length > 0) {
			const err = new RuntimeGraphQLError(
				result.errors.map((error) => error.message).join('. ')
			)
			err.raw = result.errors
			throw err
		}

		// hand the data back so callers can use the mutation's result (e.g. `const data =
		// await mutate(...)`), not just its side effects. Errors already threw above, so data is
		// present on a successful mutation.
		return result.data as _Result
	}

	return [mutate as MutationHandler<_Result, _Input, _Optimistic>, pending]
}

export class RuntimeGraphQLError extends Error {
	raw: QueryResult['errors'] = []
}
