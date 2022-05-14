import path from 'path'
import { Config } from '../../../common'
import { CollectedGraphQLDocument } from '../../types'
import { writeFile } from '../../utils'
import { log, logGreen } from '../../../common/log'

export async function generateIndividualStoreQuery(config: Config, doc: CollectedGraphQLDocument) {
	const queriesStore: string[] = []
	const queriesStoreDTs: string[] = []

	const storeName = config.storeName(doc) // "1 => GQL_All$Items" => ${storeName}
	const artifactName = `${doc.name}` // "2 => All$Items" => ${artifactName}

	// STORE
	const queryStoreGenerated = `import { writable } from 'svelte/store'
import { ${artifactName} as artifact } from '../artifacts'
import { CachePolicy, fetchQuery, RequestContext, DataSource } from '../runtime'
import { getPage, getSession, isBrowser } from '../runtime/adapter.mjs'
import cache from '../runtime/cache'
import { marshalInputs, unmarshalSelection } from '../runtime/scalars'
import { houdiniConfig } from '$houdini'
import { stry } from '@kitql/helper'

// TODO:
// - [x] smarter than JSON.stringify to compare if it's updated
// - [ ] track: https://github.com/sveltejs/kit/issues/2979 is see if we could have a better load without context!
// - [ ] cache policies aren't implemented yet
// - [ ] params.policy > artifact.policy
// - [ ] context client side (getPage, getSession) => GetStores issue

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

  async function queryLoad(ctx, params) {
    const context = new RequestContext(ctx)
    return await queryLocal(context, params)
  }

  async function query(params) {
    const context = new RequestContext({
      //page: getPage(),
      fetch: fetch,
      //session: getSession(),
    })

    return await queryLocal(context, params)
  }

  async function queryLocal(context, params) {
    update((c) => {
      return { ...c, isFetching: true }
    })

    // default params values if no params are passed
    params = params ?? { variables: {} }

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
      cached: artifact.policy !== CachePolicy.NetworkOnly,
    })

    // setup a subscription for new values from the cache
    if (isBrowser) {
      // if we're already subscribing, don't do anything
      // if (subscriptionSpec) {
      // 	return
      // }
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
        artifact.policy === CachePolicy.CacheAndNetwork
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
      if (toReturn.partial && artifact.policy === CachePolicy.CacheOrNetwork) {
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
    load,

    // For CSR
    query,

    // We don't want to give the option to set or update the store manually
    // set, update
  }
}

export const ${storeName} = ${storeName}Store()  
`
	queriesStore.push(queryStoreGenerated)
	// STORE END

	// TYPES
	const queryStoreGeneratedDTs = `import type { ${artifactName}$input, ${artifactName}$result, CachePolicy } from '$houdini'
import type { LoadInput } from '@sveltejs/kit'
import type { Result } from './index'

type ${storeName}_data = ${artifactName}$result | undefined

type ${storeName}_params = {
  variables?: ${artifactName}$input
  policy?: CachePolicy
}

export declare const ${storeName}: SvelteStore<Result<${storeName}_data>> & {
  /**
   * Trigger the query form load function
   */
  load: (
    loadInput: LoadInput,
    params?: ${storeName}_params
  ) => Promise<Result<${storeName}_data>>

  /**
   * Trigger the query form client side (a component for example)
   */
  query: (params?: ${storeName}_params) => Promise<Result<${storeName}_data>>
}
  `
	queriesStoreDTs.push(queryStoreGeneratedDTs)
	// TYPES END

	await writeFile(path.join(config.rootDir, 'stores', `${storeName}.js`), queriesStore.join(`\n`))

	await writeFile(
		path.join(config.rootDir, 'stores', `${storeName}.d.ts`),
		queriesStoreDTs.join(`\n`)
	)

	log.info(`✅ ${logGreen(storeName)} query store`)

	return storeName
}
