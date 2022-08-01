// locals
import { getHoudiniContext, Operation, GraphQLTagResult } from '../lib'

export type MutationConfig<_Result, _Input> = {
	optimisticResponse?: _Result
}

export function mutation<_Mutation extends Operation<any, any>>(store: GraphQLTagResult) {
	// make sure we got a query store
	if (store.kind !== 'HoudiniMutation') {
		throw new Error('mutation() must be passed a mutation store')
	}

	const context = getHoudiniContext()

	return async (
		variables: _Mutation['input'],
		mutationConfig?: MutationConfig<_Mutation['result'], _Mutation['input']>
	): Promise<_Mutation['result']> => {
		const { data } = await store.mutate({
			variables,
			...mutationConfig,
			context,
		})

		return data
	}
}
