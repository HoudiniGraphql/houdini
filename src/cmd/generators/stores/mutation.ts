import path from 'path'
import { Config } from '../../../common'
import { CollectedGraphQLDocument } from '../../types'
import { writeFile } from '../../utils'

export async function generateIndividualStoreMutation(
	config: Config,
	doc: CollectedGraphQLDocument
) {
	const storeData: string[] = []
	const storeDataDTs: string[] = []

	const fileName = doc.name
	const storeName = config.storeName(doc) // "1 => GQL_Add$Item" => ${storeName}
	const artifactName = `${doc.name}` // "2 => Add$Item" => ${artifactName}

	// STORE
	const storeDataGenerated = `import { houdiniConfig } from '$houdini'
import { writable } from 'svelte/store'
import { ${artifactName} as artifact } from '../artifacts'
import { executeQuery } from '../runtime'
import { getSession } from '../runtime/adapter.mjs'
import cache from '../runtime/cache'
import { marshalInputs, marshalSelection, unmarshalSelection } from '../runtime/scalars'

function ${storeName}Store() {
	const { subscribe, set, update } = writable({
			data: null,
			errors: null,
			isFetching: false,
			variables: null
	});

	async function mutate({ variables, context, ...config }) {

		if(!context){
			context = {}
		}

		update((c) => {
			return { ...c, isFetching: true }
		})

		// grab the session from the adapter
		const sessionStore = context.session

		// treat a mutation like it has an optimistic layer regardless of
		// whether there actually _is_ one. This ensures that a query which fires
		// after this mutation has been sent will overwrite any return values from the mutation
		//
		// as far as I can tell, this is an arbitrary decision but it does give a
		// well-defined ordering to a subtle situation so that seems like a win
		//
		const layer = cache._internal_unstable.storage.createLayer(true)

		// if there is an optimistic response then we need to write the value immediately
		const optimisticResponse = config?.optimisticResponse
		// hold onto the list of subscribers that we updated because of the optimistic response
		// and make sure they are included in the final set of subscribers to notify
		let toNotify = []
		if (optimisticResponse) {
			toNotify = cache.write({
				selection: artifact.selection,
				// make sure that any scalar values get processed into something we can cache
				data: marshalSelection({
					config: houdiniConfig,
					selection: artifact.selection,
					data: optimisticResponse,
				}),
				variables,
				layer: layer.id,
			})
		}

		try {
			// trigger the mutation
			const { result } = await executeQuery(
				artifact,
				marshalInputs({
					input: variables,
					artifact,
					config: houdiniConfig,
				}),
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
				// write to the mutation's layer
				layer: layer.id,
				// notify any subscribers that we updated with the optimistic response
				// in order to address situations where the optimistic update was wrong
				notifySubscribers: toNotify,
				// make sure that we notify subscribers for any values that we overwrite
				// in order to address any race conditions when comparing the previous value
				forceNotify: true,
			})

			// merge the layer back into the cache
			cache._internal_unstable.storage.resolveLayer(layer.id)

			// prepare store data
			const storeData = {
				data: unmarshalSelection(houdiniConfig, artifact.selection, result.data),
				errors: result.errors,
				isFetching: false,
				variables
			}

			// update the store value
			set(storeData)

			// return the value to the caller
			return storeData
		} catch (error) {
			// if the mutation failed, roll the layer back and delete it
			layer.clear()
			cache._internal_unstable.storage.resolveLayer(layer.id)

			// bubble the mutation error up to the caller
			throw error
		}
	}

	return {
		subscribe,
		mutate,
	}
}

const store = ${storeName}Store()

export default store

export const ${storeName} = store
`
	storeData.push(storeDataGenerated)
	// STORE END

	// TYPES
	const storeDataDTsGenerated = `import type { ${artifactName}$input, ${artifactName}$result } from '$houdini'
import type { MutationStore } from '../runtime/types'

export declare const ${storeName}: MutationStore<${artifactName}$result | undefined, ${artifactName}$input>
  `
	storeDataDTs.push(storeDataDTsGenerated)
	// TYPES END

	await writeFile(path.join(config.rootDir, 'stores', `${fileName}.js`), storeData.join(`\n`))

	await writeFile(
		path.join(config.rootDir, 'stores', `${fileName}.d.ts`),
		storeDataDTs.join(`\n`)
	)

	return fileName
}
