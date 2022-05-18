import path from 'path'
import { Config } from '../../../common'
import { log, logGreen } from '../../../common/log'
import { CollectedGraphQLDocument } from '../../types'
import { writeFile } from '../../utils'

export async function generateIndividualStoreMutation(
	config: Config,
	doc: CollectedGraphQLDocument
) {
	const storeData: string[] = []
	const storeDataDTs: string[] = []

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
		partial: false,
		result: null,
		source: null,
		isFetching: false,
	})

	// Track subscriptions
	let subscriptionSpec = null

	// Current variables tracker
	let variables = {}

	async function mutate(params) {
		update((c) => {
			return { ...c, isFetching: true }
		})

		// params management
		params = params ?? {}

		// grab the session from the adapter
		const sessionStore = getSession()

		// treat a mutation like it has an optimistic layer regardless of
		// whether there actually _is_ one. This ensures that a query which fires
		// after this mutation has been sent will overwrite any return values from the mutation
		//
		// as far as I can tell, this is an arbitrary decision but it does give a
		// well-defined ordering to a subtle situation so that seems like a win
		//
		const layer = cache._internal_unstable.storage.createLayer(true)

		// if there is an optimistic response then we need to write the value immediately
		const optimisticResponse = params?.optimisticResponse
		// hold onto the list of subscribers that we updated because of the optimistic response
		// and make sure they are included in the final set of subscribers to notify
		let subscriptionSpec = []
		if (optimisticResponse) {
			subscriptionSpec = cache.write({
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
			// trigger the mutation on the server
			const { result } = await executeQuery(
				artifact,
				marshalInputs({
					input: variables,
					// @ts-ignore: document.artifact is no longer defined
					artifact: document.artifact,
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
				notifySubscribers: subscriptionSpec,
				// make sure that we notify subscribers for any values that we overwrite
				// in order to address any race conditions when comparing the previous value
				forceNotify: true,
			})

			// merge the layer back into the cache
			cache._internal_unstable.storage.resolveLayer(layer.id)

			// turn any scalars in the response into their complex form
			return unmarshalSelection(houdiniConfig, artifact.selection, result.data)
		} catch (error) {
			// if the mutation failed, roll the layer back and delete it
			layer.clear()
			cache._internal_unstable.storage.resolveLayer(layer.id)

			// bubble the mutation error up to the caller
			throw error
		}
	}

	return {
		subscribe: (...args) => {
			const parentUnsubscribe = subscribe(...args)

			// Handle unsubscribe
			return () => {
				if (subscriptionSpec) {
					cache.unsubscribe(subscriptionSpec, variables)
					subscriptionSpec = null
				}

				parentUnsubscribe()
			}
		},

		mutate,
	}
}

export const ${storeName} = ${storeName}Store()	
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

	await writeFile(path.join(config.rootDir, 'stores', `${storeName}.js`), storeData.join(`\n`))

	await writeFile(
		path.join(config.rootDir, 'stores', `${storeName}.d.ts`),
		storeDataDTs.join(`\n`)
	)

	log.info(`✅ ${logGreen(storeName)} mutation store`)

	return storeName
}
