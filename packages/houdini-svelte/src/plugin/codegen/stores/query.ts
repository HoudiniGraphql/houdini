import type * as graphql from 'graphql'
import type { Document, GenerateHookInput } from 'houdini'
import { fs, operation_requires_variables, path } from 'houdini'

import type { HoudiniSvelteConfig } from '../../config'
import { stores_directory, store_name } from '../../storeConfig'
import { store_import } from './custom'

export async function queryStore({ config, pluginRoot }: GenerateHookInput, doc: Document) {
	const fileName = doc.name
	const artifactName = `${doc.name}`
	const storeName = store_name({ config, name: doc.name })

	let variables = false
	const operation = doc.originalParsed.definitions.find(
		(defn) => defn.kind === 'OperationDefinition' && defn.operation === 'query'
	) as graphql.OperationDefinitionNode
	if (operation) {
		// an operation requires variables if there is any non-null variable that doesn't have a default value
		variables = operation_requires_variables(operation)
	}

	// which functions we pull from the handlers depends on the pagination method
	// specified by the artifact
	const paginationMethod = doc.refetch?.paginated && doc.refetch.method

	// in order to build the store, we need to know what class we're going to import from
	let which: keyof Required<HoudiniSvelteConfig>['customStores'] = 'query'
	if (paginationMethod === 'cursor') {
		which = 'queryCursor'
	} else if (paginationMethod === 'offset') {
		which = 'queryOffset'
	}

	// store definition
	const { store_class, statement } = store_import(config, which)
	const storeData = `${statement}
import artifact from '$houdini/artifacts/${artifactName}'
import { initClient } from '$houdini/plugins/houdini-svelte/runtime/client'

export class ${storeName} extends ${store_class} {
	constructor() {
		super({
			artifact,
			storeName: ${JSON.stringify(storeName)},
			variables: ${JSON.stringify(variables)},
		})
	}
}

export async function load_${artifactName}(params) {
  await initClient()

	const store = new ${storeName}()

	await store.fetch(params)

	return {
		${artifactName}: store,
	}
}
`

	const _input = `${artifactName}$input`
	const _data = `${artifactName}$result`

	// the type definitions for the store
	const typeDefs = `import type { ${_input}, ${_data}, ${store_class}, QueryStoreFetchParams} from '$houdini'

export declare class ${storeName} extends ${store_class}<${_data}, ${_input}> {
	/**
	 * ### Route Loads
	 * In a route's load function, manually instantiating a store can be used to look at the result:
	 *
	 * \`\`\`js
	 * export async function load(event) {
	 * 	const store = new ${storeName}Store()
	 * 	const { data } = await store.fetch({event})
	 *  console.log('do something with', data)
	 *
	 * 	return {
	 * 		${storeName}: store,
	 * 	}
	 * }
	 *
	 * \`\`\`
	 *
	 * ### Client Side Loading
	 * When performing a client-side only fetch, the best practice to use a store _manually_ is to do the following:
	 *
	 * \`\`\`js
	 * const store = new ${storeName}Store()
	 *
	 * $: browser && store.fetch({ variables });
	 * \`\`\`
	 */
	constructor() {
		// @ts-ignore
		super({})
	}
}

/**
 * ### Manual Loads
 * Usually your load function will look like this:
 *
 * \`\`\`js
 * import { load_${artifactName} } from '$houdini';
 * import type { PageLoad } from './$types';
 *
 * export const load: PageLoad = async (event) => {
 *   const variables = {
 *     id: // Something like: event.url.searchParams.get('id')
 *   };
 *
 *   return await load_${artifactName}({ event, variables });
 * };
 * \`\`\`
 *
 * ### Multiple stores to load
 * You can trigger them in parallel with \`loadAll\` function
 *
 * \`\`\`js
 * import { loadAll, load_${artifactName} } from '$houdini';
 * import type { PageLoad } from './$types';
 *
 * export const load: PageLoad = async (event) => {
 *   const variables = {
 *     id: // Something like: event.url.searchParams.get('id')
 *   };
 *
 *   return await await loadAll(
 *     load_${artifactName}({ event, variables }),
 *     // load_ANOTHER_STORE
 *   );
 * };
 * \`\`\`
 */
export declare const load_${artifactName}: (params: QueryStoreFetchParams<${_data}, ${_input}>) => Promise<{${artifactName}: ${storeName}}>
`

	await Promise.all([
		fs.writeFile(path.join(stores_directory(pluginRoot), `${fileName}.js`), storeData),
		fs.writeFile(path.join(stores_directory(pluginRoot), `${fileName}.d.ts`), typeDefs),
	])

	return fileName
}
