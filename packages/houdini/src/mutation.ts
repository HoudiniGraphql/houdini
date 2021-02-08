// externals
import { GraphQLTagResult } from 'houdini-preprocess'
import { CompiledMutationKind } from 'houdini-compiler'
// locals
import { getEnvironment } from './environment'

// mutation returns a handler that will send the mutation to the server when
// invoked
export default function mutation(document: GraphQLTagResult) {
	// make sure we got a query document
	if (document.kind !== CompiledMutationKind) {
		throw new Error('getQuery can only take query operations')
	}
	// pull the query text out of the compiled artifact
	const { raw: text } = document

	// if there is no environment configured
	const currentEnv = getEnvironment()
	if (!currentEnv) {
		throw new Error('Please provide an environment')
	}

	// return an async function that sends the mutation go the server
	return async (variables: any) => {
		// grab the response from the server
		const { data } = await currentEnv.sendRequest({ text, variables })

		// wrap the result in a store we can use to keep this query up to date
		return document.processResult(data)
	}
}
