// externals
import { GraphQLTagResult } from 'houdini-preprocess'
import { CompiledMutationKind } from 'houdini-compiler'
// locals
import { getDocumentStores, applyPatch, fetchQuery } from './runtime'
import { Operation } from './types'
import { FetchContext } from './environment'

// mutation returns a handler that will send the mutation to the server when
// invoked
export default function mutation<_Mutation extends Operation<any, any>>(
	document: GraphQLTagResult
): (_input: _Mutation['input']) => Promise<_Mutation['result']> {
	// make sure we got a query document
	if (document.kind !== CompiledMutationKind) {
		throw new Error('getQuery can only take query operations')
	}
	// pull the query text out of the compiled artifact
	const { raw: text, links: linkModule } = document

	// return an async function that sends the mutation go the server
	return async (variables: _Mutation['input']) => {
		// we need to define a fetch context that plays well on the client without
		// access to this.fetch (mutations can't get access to preload)
		const mutationCtx: FetchContext = {
			fetch: window.fetch,
			error: (code: number, message: string) => {
				console.warn('dont know what to do with this just yet')
			},
			redirect: (code: number, location: string) => {
				console.warn('dont know what to do with this just yet')
			},
		}

		// grab the response from the server
		const { data } = await fetchQuery(mutationCtx, { text, variables })

		// we could have gotten a null response
		if (!data) {
			throw new Error('Encountered error')
		}

		// we need to update any that this mutation touches
		// wait for the link module to load
		linkModule.then(({ default: links }) => {
			// every entry in the link could point to a store that needs to update
			// we can process them in parallel since there is no shared data
			Promise.all(
				Object.entries(links()).map(async ([documentName, patchModule]) => {
					// wait for the patch to load
					const { default: patch } = await patchModule
					// apply the changes to any stores that have registered themselves
					for (const { currentValue, updateValue, variables } of getDocumentStores(
						documentName
					)) {
						// apply the patch
						applyPatch(patch, updateValue, currentValue, data, variables)
					}
				})
			)
		})

		// wrap the result in a store we can use to keep this query up to date
		return document.processResult(data)
	}
}
