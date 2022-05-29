import path from 'path'
import { Config } from '../../../common'
import { CollectedGraphQLDocument } from '../../types'
import { writeFile } from '../../utils'
import { log, logGreen } from '../../../common/log'
import pagination from './pagination'

export async function generateIndividualStoreQuery(config: Config, doc: CollectedGraphQLDocument) {
	const storeData: string[] = []
	const storeDataDTs: string[] = []

	const storeName = config.storeName(doc) // "1 => GQL_All$Items" => ${storeName}
	const artifactName = `${doc.name}` // "2 => All$Items" => ${artifactName}

	const paginationExtras = pagination(config, doc)

	// STORE
	const storeDataGenerated = `import { houdiniConfig } from '$houdini'
import { stry } from '@kitql/helper'
import { writable } from 'svelte/store'
import { ${artifactName} as artifact } from '../artifacts'
import { CachePolicy, DataSource, fetchQuery, RequestContext } from '../runtime'
import { getSession, isBrowser } from '../runtime/adapter.mjs'
import cache from '../runtime/cache'
import { marshalInputs, unmarshalSelection } from '../runtime/scalars'

// optional pagination imports 
${paginationExtras.imports}

// TODO:
// - [ ] track: https://github.com/sveltejs/kit/issues/2979 is see if we could have a better load without context!

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

    
    async function queryLoad(params) {
		const context = new RequestContext(params.context)
		return await queryLocal(context, params)
	}

	async function query(params) {
		const { session, page } = params.context

		const context = new RequestContext({
			fetch: fetch,
			page,
			session,
		})

		return await queryLocal(context, params)
	}

    async function queryLocal(context, params) {
        update((c) => {
            return { ...c, isFetching: true }
        })

        // params management
        params = params ?? {}
       
        // If no policy specified => artifact.policy, if there is nothing go to CacheOrNetwork
        if (!params.policy) {
            params.policy = artifact.policy ?? CachePolicy.CacheOrNetwork
        }

        const newVariables = marshalInputs({
            artifact,
            config: houdiniConfig,
            input: params.variables,
        })

        let toReturn = await fetchQuery({
            context,
            artifact,
            variables: newVariables,
            session: context.session,
            cached: params.policy !== CachePolicy.NetworkOnly,
        })

        // setup a subscription for new values from the cache
        if (isBrowser) {
            
            subscriptionSpec = {
                rootType: artifact.rootType,
                selection: artifact.selection,
                variables: () => newVariables,
                set: set,
            }
            cache.subscribe(subscriptionSpec, variables)

            const updated = stry(variables, 0) !== stry(newVariables, 0)

            // if the variables changed we need to unsubscribe from the old fields and
            // listen to the new ones
            if (updated && subscriptionSpec) {
                cache.unsubscribe(subscriptionSpec, variables)
            }

            // if the data was loaded from a cached value, and the document cache policy wants a
            // network request to be sent after the data was loaded, load the data
            if (
                toReturn.source === DataSource.Cache &&
                params.policy === CachePolicy.CacheAndNetwork
            ) {
                // this will invoke pagination's refetch because of javascript's magic this binding
                fetchQuery({
                    context,
                    artifact,
                    variables: newVariables,
                    session: context.session,
                    cached: false,
                })
            }

            // if we have a partial result and we can load the rest of the data
            // from the network, send the request
            if (toReturn.partial && params.policy === CachePolicy.CacheOrNetwork) {
                fetchQuery({
                    context,
                    artifact,
                    variables: newVariables,
                    session: context.session,
                    cached: false,
                })
            }

            // update the cache with the data that we just ran into
            cache.write({
                selection: artifact.selection,
                data: toReturn.result.data,
                variables: newVariables,
            })

            if (updated && subscriptionSpec) {
                cache.subscribe(subscriptionSpec, newVariables)
            }

            // update Current variables tracker
            variables = newVariables
        }

        set({
            ...toReturn,
            result: {
                ...toReturn.result,
                data: unmarshalSelection(houdiniConfig, artifact.selection, toReturn.result.data),
            },
            isFetching: false,
        })

        return toReturn
    }

    ${paginationExtras.preamble}

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

        // For SSR
        queryLoad,

        // For CSR
        query,

        // For internal usage only.
        setPartial: (partial) => update(s => ({...s, partial })),

        ${paginationExtras.methods}
    }
}

export const ${storeName} = ${storeName}Store()  
`
	storeData.push(storeDataGenerated)
	// STORE END

	// TYPES
	const storeDataDTsGenerated = `import type { ${artifactName}$input, ${artifactName}$result, CachePolicy } from '$houdini'
import { QueryStore } from '../runtime/types'

export declare const ${storeName}: QueryStore<${artifactName}$result | undefined, ${artifactName}$input> ${paginationExtras.types}
  `
	storeDataDTs.push(storeDataDTsGenerated)
	// TYPES END

	await writeFile(path.join(config.rootDir, 'stores', `${storeName}.js`), storeData.join(`\n`))

	await writeFile(
		path.join(config.rootDir, 'stores', `${storeName}.d.ts`),
		storeDataDTs.join(`\n`)
	)

	log.success(`${logGreen(storeName)} query store`, { level: 3 })

	return storeName
}
