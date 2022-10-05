import * as graphql from 'graphql'
import { CollectedGraphQLDocument, GenerateHookInput } from 'houdini'
import { operation_requires_variables, fs } from 'houdini'
import path from 'path'

import { global_store_name, stores_directory, store_name } from '../../kit'

export async function generateIndividualStoreQuery(
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
	let queryClass = 'QueryStore'
	if (paginationMethod === 'cursor') {
		queryClass =
			doc.refetch?.direction === 'forward'
				? 'QueryStoreForwardCursor'
				: 'QueryStoreBackwardCursor'
	} else if (paginationMethod === 'offset') {
		queryClass = 'QueryStoreOffset'
	}

	// store definition
	const storeData = `import { ${queryClass} } from '../runtime/stores'
import artifact from '../artifacts/${artifactName}'

// create the query store

export class ${storeName} extends ${queryClass} {
	constructor() {
		super({
			artifact,
			storeName: ${JSON.stringify(storeName)},
			variables: ${JSON.stringify(variables)},
		})
	}
}

export async function load_${artifactName}(params) {
	const store = new ${storeName}()

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
	const typeDefs = `import type { ${_input}, ${_data}, ${queryClass}, QueryStoreFetchParams} from '$houdini'

export declare class ${storeName} extends ${queryClass}<${_data}, ${_input}> {
	constructor() {
		// @ts-ignore
		super({})
	}
}

export const ${globalStoreName}: ${storeName}

export declare const load_${artifactName}: (params: QueryStoreFetchParams<${_data}, ${_input}>) => Promise<{${artifactName}: ${storeName}}>

export default ${storeName}
`

	await Promise.all([
		fs.writeFile(path.join(stores_directory(plugin_root), `${fileName}.js`), storeData),
		fs.writeFile(path.join(stores_directory(plugin_root), `${fileName}.d.ts`), typeDefs),
	])

	return fileName
}
