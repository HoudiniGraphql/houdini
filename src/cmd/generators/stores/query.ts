import * as graphql from 'graphql'
import path from 'path'

import { Config, operation_requires_variables, writeFile } from '../../../common'
import { CollectedGraphQLDocument } from '../../types'

export async function generateIndividualStoreQuery(config: Config, doc: CollectedGraphQLDocument) {
	const fileName = doc.name
	const artifactName = `${doc.name}`
	const storeName = artifactName + 'Store'
	const globalStoreName = config.globalStoreName(doc)

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

	// look for the operation
	const operations = doc.document.definitions.filter(
		({ kind }) => kind === graphql.Kind.OPERATION_DEFINITION
	) as graphql.OperationDefinitionNode[]
	const inputs = operations[0]?.variableDefinitions
	const withVariableInputs = inputs && inputs.length > 0
	const variableInputsType = withVariableInputs ? `${artifactName}$input` : 'null'

	const _data = `${artifactName}$result`

	// type definitions
	const typeDefs = `import type { ${_data}, ${queryClass}, ${
		variableInputsType ? `${artifactName}$input` : ''
	}, QueryStoreFetchParams} from '$houdini'

export declare class ${storeName} extends ${queryClass}<${_data}, ${variableInputsType}> {
	constructor() {}
}

export const ${globalStoreName}: ${storeName}

export declare const load_${artifactName}: (params: QueryStoreFetchParams<${variableInputsType}>) => Promise<{${artifactName}: ${storeName}}>

export default ${storeName}
`

	await Promise.all([
		writeFile(path.join(config.storesDirectory, `${fileName}.js`), storeData),
		writeFile(path.join(config.storesDirectory, `${fileName}.d.ts`), typeDefs),
	])

	return fileName
}
