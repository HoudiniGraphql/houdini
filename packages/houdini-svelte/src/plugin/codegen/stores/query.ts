import * as graphql from 'graphql'
import { CollectedGraphQLDocument, GenerateHookInput, path } from 'houdini'
import { operation_requires_variables, fs } from 'houdini'

import type { HoudiniVitePluginConfig } from '../..'
import { global_store_name, stores_directory, store_name } from '../../kit'
import { store_import } from './custom'

export async function queryStore(
	{ config, plugin_root }: GenerateHookInput,
	doc: CollectedGraphQLDocument
) {
	const fileName = doc.name
	const artifactName = `${doc.name}`
	const storeName = store_name({ config, name: doc.name })
	const globalStoreName = global_store_name({ config, name: doc.name })

	let variables = false
	const operation = doc.originalDocument.definitions.find(
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
	let which: keyof Required<HoudiniVitePluginConfig>['customStores'] = 'query'
	if (paginationMethod === 'cursor') {
		which =
			doc.refetch?.direction === 'forward' ? 'queryForwardsCursor' : 'queryBackwardsCursor'
	} else if (paginationMethod === 'offset') {
		which = 'queryOffset'
	}

	// store definition
	const { store_class, statement } = store_import(config, which)
	const storeData = `${statement}
import artifact from '$houdini/artifacts/${artifactName}'

export class ${storeName} extends ${store_class} {
	constructor(tentativeInitFromCache) {
		super({
			artifact,
			storeName: ${JSON.stringify(storeName)},
			variables: ${JSON.stringify(variables)},
			tentativeInitFromCache
		})
	}
}

export async function load_${artifactName}(params) {
	const store = new ${storeName}(true)
	
	await store.init(params);

	await store.fetch(params)

	return {
		${artifactName}: store,
	}
}

export const ${globalStoreName} = new ${storeName}()

export default ${globalStoreName}
`

	const _input = `${artifactName}$input`
	const _data = `${artifactName}$result`

	// the type definitions for the store
	const typeDefs = `import type { ${_input}, ${_data}, ${store_class}, QueryStoreFetchParams} from '$houdini'

export declare class ${storeName} extends ${store_class}<${_data}, ${_input}> {
	/**
	 * ## Default usage
	 * The best practice to use a store _manually_ is to do the following:
	 * 
	 * \`\`\`js
	 * const store = new ${storeName}Store(true)
	 * await store.init({ variables })
	 * 
	 * $: browser && store.fetch({ variables });
	 * \`\`\`
	 * 
	 * ### Side node
	 * It's still possible to do only \`const store = new ${storeName}Store()\`
	 * and avoid the \`await store.init({ variables })\` line.
	 * However, without init, isFetching can be wrong and will cause a small flash in the ui.
	 */
	constructor(tentativeInitFromCache?: boolean) {
		// @ts-ignore
		super({})
	}
}

/**
 * ## Default usage
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
 * ## Multiple stores to load
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

export const ${globalStoreName}: ${storeName}

export default ${storeName}
`

	await Promise.all([
		fs.writeFile(path.join(stores_directory(plugin_root), `${fileName}.js`), storeData),
		fs.writeFile(path.join(stores_directory(plugin_root), `${fileName}.d.ts`), typeDefs),
	])

	return fileName
}
