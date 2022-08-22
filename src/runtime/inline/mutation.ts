import { Operation, GraphQLTagResult, CompiledMutationKind } from '../lib/types'
import { MutationConfig, MutationStore } from '../stores'

export function mutation<_Mutation extends Operation<any, any>>(store: GraphQLTagResult) {
	// make sure we got a query store
	if (store.kind !== CompiledMutationKind) {
		throw new Error('mutation() must be passed a mutation store')
	}

	const mutationStore = store as MutationStore<any, any>

	return async (
		variables: _Mutation['input'],
		mutationConfig?: MutationConfig<_Mutation['result'], _Mutation['input']>
	): Promise<_Mutation['result']> => {
		const { data } = await mutationStore.mutate(variables, { ...mutationConfig })

		return data
	}
}
