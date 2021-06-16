// locals
import { executeQuery } from './network'
import { Operation, GraphQLTagResult, MutationArtifact } from './types'
import cache from './cache'
import { getVariables } from './context'

// @ts-ignore: this file will get generated and does not exist in the source code
import { getSession, goTo } from './adapter.mjs'

// mutation returns a handler that will send the mutation to the server when
// invoked
export default function mutation<_Mutation extends Operation<any, any>>(
	document: GraphQLTagResult
): (_input: _Mutation['input']) => Promise<_Mutation['result']> {
	// make sure we got a query document
	if (document.kind !== 'HoudiniMutation') {
		throw new Error('mutation() must be passed a mutation document')
	}

	// we might get the the artifact nested under default
	const artifact: MutationArtifact =
		// @ts-ignore: typing esm/cjs interop is hard
		document.artifact.default || document.artifact

	// grab the session from the adapter
	const sessionStore = getSession()

	const queryVariables = getVariables()

	// return an async function that sends the mutation go the server
	return async (variables: _Mutation['input']) => {
		try {
			const result = await executeQuery<_Mutation['result']>(
				artifact,
				variables,
				sessionStore
			)

			cache.write(artifact.selection, result.data, queryVariables())

			return result.data
		} catch (error) {
			throw error
		}
	}
}
