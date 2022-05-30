// externals
import path from 'path'
// locals
import { Config } from '../../../common'
import { CollectedGraphQLDocument } from '../../types'
import { writeFile } from '../../utils'

export async function generateSubscriptionStore(config: Config, doc: CollectedGraphQLDocument) {
	const fileName = doc.name
	const storeName = config.storeName(doc) // "1 => GQL_Item$Update" => ${storeName}
	const artifactName = `${doc.name}` // "2 => Item$Update" => ${artifactName}

	// the content of the store
	const storeContent = `import { writable } from 'svelte/store'
import { ${artifactName} as artifact } from '../artifacts'
import cache from '../runtime/cache'
import { getCurrentClient } from '../runtime/network'
import { marshalInputs, unmarshalSelection } from '../runtime/scalars'

// a store that holds the latest value
const result = writable(null)

// pull the query text out of the compiled artifact
const { raw: text, selection } = artifact.default || artifact

// the function to call to unregister the subscription
let clearSubscription = () => {}

export const ${storeName} = {
	subscribe(variables) {
		// pull out the current client
		const env = getCurrentClient()
		// if there isn't one, yell loudly
		if (!env) {
			throw new Error('Could not find Houdini Client')
		}
		// we need to make sure that the user provided a socket connection
		if (!env.socket) {
			throw new Error(
				'The current Houdini Client is not configured to handle subscriptions. Make sure you ' +
					'passed a socketClient to HoudiniClient constructor.'
			)
		}

		// clear any existing subscription
		clearSubscription()

		// marshal the inputs into their raw values
		const marshaledVariables = marshalInputs({
			input: variables || {},
			config: config,
			artifact: document.artifact,
		})

		// start listening for updates from the server
		clearSubscription = env.socket.subscribe(
			{
				query: text,
				variables: marshaledVariables,
			},
			{
				next({ data, errors }) {
					// make sure there were no errors
					if (errors) {
						throw errors
					}

					// if we got a result
					if (data) {
						// update the cache with the result
						cache.write({
							selection,
							data,
							variables: marshaledVariables,
						})

						// update the local store
						result.set(unmarshalSelection(config, artifact.selection, data))
					}
				},
				error(data) {},
				complete() {},
			}
		)
	},
	unsubscribe() {
		clearSubscription()
	},
}

export default ${storeName}
`

	// the type definitions for the store
	const typeDefs = `
`

	// write the store contents to disk
	await Promise.all([
		writeFile(path.join(config.rootDir, 'stores', `${fileName}.d.ts`), typeDefs),
		writeFile(path.join(config.storesDirectory, `${fileName}.js`), storeContent),
	])

	// return the store name to the generator so the index file can be created
	return fileName
}
