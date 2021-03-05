// locals
import { getDocumentStores, applyPatch } from './runtime'
import { RequestContext, fetchQuery } from './network'
import { Operation, GraphQLTagResult } from './types'
// @ts-ignore: this file will get generated and does not exist in the source code
import { getSession, goTo } from './adapter.mjs'

// mutation returns a handler that will send the mutation to the server when
// invoked
export default function mutation<_Mutation extends Operation<any, any>>(
	document: GraphQLTagResult
): (_input: _Mutation['input']) => Promise<_Mutation['result']> {
	// make sure we got a query document
	if (document.kind !== 'HoudiniMutation') {
		throw new Error('getQuery can only take query operations')
	}

	// pull the query text out of the compiled artifact
	const { raw: text, links: linkModule } = document

	// grab the sesion from the adapter
	const session = getSession()

	// return an async function that sends the mutation go the server
	return (variables: _Mutation['input']) =>
		// we want the mutation to throw an error if the network layer invokes this.error
		new Promise(async (resolve, reject) => {
			let result

			// since we have a promise that's wrapping async/await we need a giant try/catch that will
			// reject the promise
			try {
				// we need to define a fetch context that plays well on the client without
				// access to this.fetch (mutations can't get access to preload)
				const mutationCtx = new RequestContext({
					fetch: window.fetch.bind(window),
					error: (code: number, e: string | Error) => {
						// if we were given an error
						if (e instanceof Error) {
							reject(e)
						} else {
							reject(new Error(e))
						}
					},
					redirect: (code: number, location: string) => {
						// send the user to the new location
						goTo(location)

						console.warn('dont know what to do with code just yet')
					},
				})

				// grab the response from the server
				const { data, errors } = await fetchQuery(mutationCtx, { text, variables }, session)

				// we could have gotten a null response
				if (errors) {
					mutationCtx.graphqlErrors(errors)
					return
				}
				if (!data) {
					mutationCtx.graphqlErrors([
						new Error('Encountered empty data response in mutation payload'),
					])
					return
				}

				// update the result
				result = data

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
							for (const {
								currentValue,
								updateValue,
								variables,
							} of getDocumentStores(documentName)) {
								// apply the patch
								applyPatch(patch, updateValue, currentValue, data, variables)
							}
						})
					)
				})
			} catch (e) {
				reject(e)
				return
			}

			// wrap the result in a store we can use to keep this query up to date
			resolve(document.processResult(result))
		})
}
