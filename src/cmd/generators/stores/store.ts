import path from 'path'
import { Config } from '../../../common'
import { ArtifactKind, CollectedGraphQLDocument } from '../../types'
import { writeFile } from '../../utils'

export async function generateIndividualStore(config: Config, doc: CollectedGraphQLDocument) {
	const prefix = 'KQL_'

	const queriesStore: string[] = []
	const queriesStoreDTs: string[] = []

	if (doc.kind === ArtifactKind.Query) {
		const storeName = `${prefix}${doc.name}` // "1 => KQL_All$Items"
		const artifactName = `${doc.name}` // "2 => All$Items"

		// STORE
		const queryStoreGenerated = `import { onDestroy, onMount } from 'svelte'
import { writable } from 'svelte/store'
import { CachePolicy, fetchQuery, RequestContext } from '../'
import { ${artifactName} as artifact } from '../artifacts'
import cache from '../runtime/cache'

// NOTES:
// - reactive statement invoking onLoad doesn't need to exist because queryLocal
//   is invoked for every load
// - refetch is just calling query
// - cache policies aren't implemented yet

function ${storeName}Store() {
  const { subscribe, set } = writable({ from: 'NO_DATA', data: null })

  // the last known variables
  let variables = {}

  // the last known page context
  let context = {}

  function query(args) {
    // use the last known context for the query
    return queryLocal(context, args)
  }

  function load(ctx, args) {
    context = new RequestContext(ctx)
    return queryLocal(ctx, args)
  }

  async function queryLocal(ctx, params) {
    // get the current session
    const session = {}
    // the current context
    //fetch => to check: https://github.com/sveltejs/kit/issues/2979

    // default params values if no params are passed
    params = params ?? { variables: {} }

    let toReturn = await fetchQuery({
      context: ctx,
      artifact,
      variables: params.variables,
      session,
      cached: artifact.policy !== CachePolicy.NetworkOnly,
    })

    // TODO: only write to the cache when the cache policy says this is a valid response
    // maybe not?

    // when the store mounts we need to setup a subscription for new values from the cache
    let subscriptionSpec = null

    onMount(() => {
      // if we're already subscribing, don't do anything
      if (subscriptionSpec) {
        return
      }

      subscriptionSpec = {
        rootType: artifact.rootType,
        selection: artifact.selection,
        variables: () => params.variables,
        set: store.set,
      }

      cache.subscribe(subscriptionSpec, variables)
    })

    onDestroy(() => {
      if (subscriptionSpec) {
        cache.unsubscribe(subscriptionSpec, variables)
        subscriptionSpec = null
      }
    })

    // TODO: be smarter than JSON.stringify
    const updated = JSON.stringify(variables) !== JSON.stringify(params.variables)

    // if the variables changed we need to unsubscribe from the old fields and
    // listen to the new ones
    if (updated && subscriptionSpec) {
      cache.unsubscribe(subscriptionSpec, variables)
    }

    // update the cache with the data that we just ran into
    cache.write({
      selection: artifact.selection,
      data,
      variables: params.variables,
    })

    if (updated && subscriptionSpec) {
      cache.subscribe(subscriptionSpec, newVariables)
    }

    // update the variable tracker
    variables = params.variables

    set(toReturn)

    return toReturn
  }

  return {
    subscribe,

    /**
     * Will trigger the query at any time
     */
    query,

    /**
     * Trigger the query on load
     */
    load,


    // We don't want to give the option to set or update the store manually
    // set, update
  }
}

export const ${storeName} = ${storeName}Store()`
		queriesStore.push(queryStoreGenerated)
		// STORE END

		// TYPES
		const queryStoreGeneratedDTs = `import type { Result } from './index'

type ${storeName}_data = {
  value: number
}

export declare const ${storeName}: SvelteStore<Result<${storeName}_data>> & {
  query: (args?: {}) => Result<${storeName}_data>
  load: (context: {}, args?: {}) => Result<${storeName}_data>
}`
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
