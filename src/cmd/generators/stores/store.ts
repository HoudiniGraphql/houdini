import path from 'path'
import { Config } from '../../../common'
import { ArtifactKind, CollectedGraphQLDocument } from '../../types'
import { writeFile } from '../../utils'

export async function generateIndividualStore(config: Config, doc: CollectedGraphQLDocument) {
	const prefix = 'KQL_'

	const queriesStore: string[] = []
	const queriesStoreDTs: string[] = []

	if (doc.kind === ArtifactKind.Query) {
		const storeName = `${prefix}${doc.name}` // "1 => KQL_All$Items" => ${storeName}
		const artifactName = `${doc.name}` // "2 => All$Items" => ${artifactName}

		// STORE
		const queryStoreGenerated = `import { writable } from 'svelte/store'
import { ${artifactName} as artifact } from '../artifacts'
import { CachePolicy, fetchQuery, RequestContext } from '../runtime'
import { getPage, getSession, isBrowser } from '../runtime/adapter.mjs'
import cache from '../runtime/cache'

// TODO:
// - [ ] cache policies aren't implemented yet
// - [ ] smarter than JSON.stringify to compare if it's updated
// - [ ] track: https://github.com/sveltejs/kit/issues/2979 is see if we could have a better load without context!

function ${storeName}Store() {
  const { subscribe, set } = writable({ partial: false, result: null, source: null })

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
      //page: getPage(), // getStores issue!
      fetch: fetch,
      //session: getSession(),
    })

    return await queryLocal(context, params)
  }

  async function queryLocal(context, params) {
    // default params values if no params are passed
    params = params ?? { variables: {} }

    let toReturn = await fetchQuery({
      context,
      artifact,
      variables: params.variables,
      session: context.session,
      cached: artifact.policy !== CachePolicy.NetworkOnly,
    })

    // setup a subscription for new values from the cache
    if (isBrowser) {
      // if we're already subscribing, don't do anything
      if (subscriptionSpec) {
        return
      }
      subscriptionSpec = {
        rootType: artifact.rootType,
        selection: artifact.selection,
        variables: () => params.variables,
        set: set,
      }
      cache.subscribe(subscriptionSpec, variables)

      const updated = JSON.stringify(variables) !== JSON.stringify(params.variables)

      // if the variables changed we need to unsubscribe from the old fields and
      // listen to the new ones
      if (updated && subscriptionSpec) {
        cache.unsubscribe(subscriptionSpec, variables)
      }

      // update the cache with the data that we just ran into
      cache.write({
        selection: artifact.selection,
        data: toReturn.result.data,
        variables: params.variables,
      })

      if (updated && subscriptionSpec) {
        cache.subscribe(subscriptionSpec, params.variables)
      }

      // update Current variables tracker
      variables = params.variables
    }

    set(toReturn)

    return toReturn
  }

  return {
    subscribe: (...args) => {
      subscribe(...args)

      // Handle unsubscribe
      return () => {
        if (subscriptionSpec) {
          cache.unsubscribe(subscriptionSpec, variables)
          subscriptionSpec = null
        }
      }
    },

    /**
     * Trigger the query form load function
     */
    queryLoad,

    /**
     * Trigger the query form client side (a component for example)
     */
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
		const queryStoreGeneratedDTs = `import type { ${artifactName}$input, ${artifactName}$result } from '$houdini'
import type { LoadInput } from '@sveltejs/kit'
import type { Result } from './index'

type ${storeName}_data = ${artifactName}$result | undefined

type ${storeName}_params = {
  variables: ${artifactName}$input
}

export declare const ${storeName}: SvelteStore<Result<${storeName}_data>> & {
  query: (params?: ${storeName}_params) => Promise<Result<${storeName}_data>>
  queryLoad: (
    loadInput: LoadInput,
    params?: ${storeName}_params
  ) => Promise<Result<${storeName}_data>>
}
`
		queriesStoreDTs.push(queryStoreGeneratedDTs)
		// TYPES END

		await writeFile(
			path.join(config.rootDir, 'stores', `${storeName}.js`),
			queriesStore.join(`\n`)
		)

		await writeFile(
			path.join(config.rootDir, 'stores', `${storeName}.d.ts`),
			queriesStoreDTs.join(`\n`)
		)

		console.log(`✅ ${storeName} store`)

		return storeName
	}

	return null
}
