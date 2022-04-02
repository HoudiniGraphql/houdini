// externals
import type { Config } from 'houdini-common'
// locals
import { executeQuery } from './network'
import { Operation, GraphQLTagResult, MutationArtifact } from './types'
import cache from './cache'
import { marshalInputs, marshalSelection, unmarshalSelection } from './scalars'

// @ts-ignore: this file will get generated and does not exist in the source code
import { getSession } from './adapter.mjs'

export type MutationConfig<_Mutation extends Operation<any, any>> = {
	optimisticResponse: _Mutation['result']
}

// mutation returns a handler that will send the mutation to the server when
// invoked
export function mutation<_Mutation extends Operation<any, any>>(
	document: GraphQLTagResult
): (
	_input: _Mutation['input'],
	config?: MutationConfig<_Mutation>
) => Promise<_Mutation['result']> {
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

	// return an async function that sends the mutation go the server
	return async (variables: _Mutation['input'], mutationConfig?: MutationConfig<_Mutation>) => {
		// pull out an optimistic response if we
		const optimisticResponse = mutationConfig?.optimisticResponse

		// treat a mutation like it has an optimistic layer regardless of
		// whether there actually _is_ one. This ensures that a query which fires
		// after this mutation has been sent will overwrite any return values from the mutation
		//
		// as far as I can tell, this is an arbitrary decision but it does give a
		// well-defined ordering to a subtle situation so that seems like a win
		//
		const layer = cache._internal_unstable.storage.createLayer(true)

		// if there is an optimistic response then we need to write the value immediately
		if (optimisticResponse) {
			cache.write({
				selection: artifact.selection,
				// make sure that any scalar values get processed into something we can cache
				data: marshalSelection({
					config,
					selection: artifact.selection,
					data: optimisticResponse,
				})!,
				variables,
				layer: layer.id,
			})
		}

		try {
			// trigger the mutation on the server
			const { result } = await executeQuery<_Mutation['result'], _Mutation['input']>(
				artifact,
				marshalInputs({
					input: variables,
					artifact: document.artifact,
					config: config,
				}) as _Mutation['input'],
				sessionStore,
				false
			)

			// clear the layer holding any mutation results
			layer.clear()

			// write the result of the mutation to the cache
			cache.write({
				selection: artifact.selection,
				data: result.data,
				variables,
				// if we had an optimistic response we need to write to the appropriate layer
				layer: layer.id,
			})

			// merge the layer back into the cache
			cache._internal_unstable.storage.resolveLayer(layer.id)

			// turn any scalars in the response into their complex form
			return unmarshalSelection(config, artifact.selection, result.data)
		} catch (error) {
			// if the mutation failed, roll the layer back and delete it
			layer.clear()
			cache._internal_unstable.storage.resolveLayer(layer.id)

			// bubble the mutation error up to the caller
			throw error
		}
	}
}
