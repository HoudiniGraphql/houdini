// externals
import type { Config } from 'houdini-common'
// locals
import { executeQuery } from './network'
import { Operation, GraphQLTagResult, MutationArtifact } from './types'
import cache from './cache'
import { getVariables } from './context'
import { marshalInputs, unmarshalSelection } from './scalars'

// @ts-ignore: this file will get generated and does not exist in the source code
import { getSession } from './adapter.mjs'

// mutation returns a handler that will send the mutation to the server when
// invoked
export function mutation<_Mutation extends Operation<any, any>>(
	document: GraphQLTagResult
): (_input: _Mutation['input']) => Promise<_Mutation['result']> {
	// make sure we got a query document
	if (document.kind !== 'HoudiniMutation') {
		throw new Error('mutation() must be passed a mutation document')
	}

	// we might get re-exported values nested under default

	// @ts-ignore: typing esm/cjs interop is hard
	const artifact: MutationArtifact = document.artifact.default || document.artifact
	// @ts-ignore: typing esm/cjs interop is hard
	const config: Config = document.config.default || document.config

	// grab the session from the adapter
	const sessionStore = getSession()

	const queryVariables = getVariables()

	// return an async function that sends the mutation go the server
	return async (variables: _Mutation['input']) => {
		try {
			const result = await executeQuery<_Mutation['result'], _Mutation['input']>(
				artifact,
				marshalInputs({
					input: variables,
					artifact: document.artifact,
					config: config,
				}) as _Mutation['input'],
				sessionStore
			)

			cache.write({
				selection: artifact.selection,
				data: result.data,
				variables: queryVariables(),
			})

			// unmarshal any scalars on the body
			return unmarshalSelection(config, artifact.selection, result.data)
		} catch (error) {
			throw error
		}
	}
}
