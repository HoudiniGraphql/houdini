// externals
import path from 'path'
import * as graphql from 'graphql'
// locals
import { Config } from '../../../common'
import { CollectedGraphQLDocument } from '../../types'
import { writeFile } from '../../utils'

export async function generateSubscriptionStore(config: Config, doc: CollectedGraphQLDocument) {
	const fileName = doc.name
	const storeName = config.storeName(doc)
	const artifactName = `${doc.name}`

	// the content of the store
	const storeContent = `import { houdiniConfig } from '$houdini'
import artifact from '../artifacts/${artifactName}'
import { subscriptionStore } from '../runtime/stores'
import { defaultConfigValues } from '../runtime/lib'

export const ${storeName} = subscriptionStore({
    config: defaultConfigValues(houdiniConfig),
	artifact,
})

export default ${storeName}
`

	// look for the operation
	const operations = doc.document.definitions.filter(
		({ kind }) => kind === graphql.Kind.OPERATION_DEFINITION
	) as graphql.OperationDefinitionNode[]
	const inputs = operations[0]?.variableDefinitions
	const withVariableInputs = inputs && inputs.length > 0
	const VariableInputsType = withVariableInputs ? `${artifactName}["input"]` : 'null'
	// the type definitions for the store
	const typeDefs = `import type { ${artifactName}, ${artifactName}$result, CachePolicy } from '$houdini'
import { SubscriptionStore } from '../runtime/lib/types'

export declare const ${storeName}: SubscriptionStore<${artifactName}$result | undefined, ${VariableInputsType}>

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
