import * as graphql from 'graphql'
import path from 'path'

import { Config, writeFile } from '../../../common'
import { CollectedGraphQLDocument } from '../../types'

export async function generateSubscriptionStore(config: Config, doc: CollectedGraphQLDocument) {
	const fileName = doc.name
	const globalStoreName = config.globalStoreName(doc)
	const artifactName = `${doc.name}`
	const storeName = artifactName + 'Store'

	// the content of the store
	const storeContent = `import artifact from '../artifacts/${artifactName}'
import { SubscriptionStore } from '../runtime/stores'

export class ${storeName} extends SubscriptionStore {
	constructor() {
		super({
			artifact,
		})
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
	const VariableInputsType = withVariableInputs ? `${artifactName}["input"]` : 'null'
	// the type definitions for the store
	const typeDefs = `import type { ${artifactName}, ${artifactName}$result, SubscriptionStore } from '$houdini'

export declare class ${storeName} extends SubscriptionStore<${artifactName}$result | undefined, ${VariableInputsType}> {
	constructor() {}
}

export const ${globalStoreName}: ${storeName}

export default ${storeName}
`

	// write the store contents to disk
	await Promise.all([
		writeFile(path.join(config.storesDirectory, `${fileName}.d.ts`), typeDefs),
		writeFile(path.join(config.storesDirectory, `${fileName}.js`), storeContent),
	])

	// return the store name to the generator so the index file can be created
	return fileName
}
