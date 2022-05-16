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

	const storeName = config.storeName(doc) // "1 => GQL_All$Items" => ${storeName}
	const artifactName = `${doc.name}` // "2 => All$Items" => ${artifactName}

	// STORE
	const storeDataGenerated = `import { writable } from 'svelte/store'
import { ${artifactName} as artifact } from '../artifacts'
import { CachePolicy, fetchQuery, RequestContext, DataSource } from '../runtime'
import { getPage, getSession, isBrowser } from '../runtime/adapter.mjs'
import cache from '../runtime/cache'
import { marshalInputs, unmarshalSelection } from '../runtime/scalars'
import { houdiniConfig } from '$houdini'
import { stry } from '@kitql/helper'

function ${storeName}Store() {
  const { subscribe, set, update } = writable({
    partial: false,
    result: null,
    source: null,
    isFetching: false,
  })

  // Current variables tracker
  let variables = {}

  async function mutate(params) {
    const context = new RequestContext({
      //page: getPage(),
      fetch: fetch,
      //session: getSession(),
    })

    return await mutateLocal(context, params)
  }

  async function mutateLocal(context, params) {
    update((c) => {
      return { ...c, isFetching: true }
    })

    // params management
    params = params ?? {}

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

    mutate,
  }
}

export const ${storeName} = ${storeName}Store()  
`
	storeData.push(storeDataGenerated)
	// STORE END

	// TYPES
	const storeDataDTsGenerated = `import type { ${artifactName}$input, ${artifactName}$result, CachePolicy } from '$houdini'
import { QueryStore } from '../runtime/types'

type ${storeName}_data = ${artifactName}$result | undefined

export declare const ${storeName}: QueryStore<${storeName}_data, ${artifactName}$input>
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
