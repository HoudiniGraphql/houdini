// externals
import path from 'path'
// locals
import { log, logGreen } from '../../../common/log'
import { Config } from '../../../common'
import { CollectedGraphQLDocument } from '../../types'
import { writeFile } from '../../utils'

export async function generateFragmentStore(config: Config, doc: CollectedGraphQLDocument) {
	const storeName = config.storeName(doc)

	// the content of the store
	const storeContent = `import { houdiniConfig } from '$houdini'
import { writable } from 'svelte/store'    
import { getCurrentClient } from '../runtime/network'
import cache from '../runtime/cache'
import { marshalInputs, unmarshalSelection } from '../runtime/scalars'
import { ${doc.name} as artifact } from '../artifacts'

// a store that holds the latest value
const result = writable(null)

// pull the query text out of the compiled artifact
const { raw: text, selection } = (artifact.default || artifact)

// the function to call to unregister the subscription
let clearSubscription = () => {}

export const ${storeName} = {
    subscribe(variables) {
        // pull out the current environment
        const env = getCurrentClient()
        // if there isn't one, yell loudly
        if (!env) {
            throw new Error('Could not find network environment')
        }
		// we need to make sure that the user provided a socket connection
		if (!env.socket) {
			throw new Error(
				'The current environment is not configured to handle subscriptions. Make sure you ' +
					'passed a client to its constructor.'
			)
		}

        // clear any existing subscription
        clearSubscription()

        // marshal the inputs into their raw values
        const variables = marshalInputs({
            input: variables || {},
            config: config,
            artifact: document.artifact,
        }) as _Subscription['input']

		// start listening for updates from the server
		clearSubscription = env.socket.subscribe(
			{
				query: text,
				variables: variables,
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
				error(data: _Subscription['result']) {},
				complete() {},
			}
		)
    },
    unsubscribe() { 
        clearSubscription()
    }
}
`

	// the type definitions for the store
	const typeDefs = `
`

	// write the store contents to disk
	await Promise.all([
		writeFile(path.join(config.rootDir, 'stores', `${storeName}.d.ts`), typeDefs),
		writeFile(path.join(config.storesDirectory, `${storeName}.js`), storeContent),
	])

	// notify the user we generated the store
	if (!config.quiet) {
		log.info(`✅ ${logGreen(storeName)} subscription store`)
	}

	// return the store name to the generator so the index file can be created
	return storeName
}
