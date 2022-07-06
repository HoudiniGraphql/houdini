import * as graphql from 'graphql'
import path from 'path'
import { Config } from '../../../common'
import { CollectedGraphQLDocument } from '../../types'
import { writeFile } from '../../utils'
import pagination from './pagination'

export async function generateIndividualStoreQuery(config: Config, doc: CollectedGraphQLDocument) {
	const fileName = doc.name
	const storeName = config.storeName(doc)
	const artifactName = `${doc.name}`

	const paginationExtras = pagination(config, doc, 'query')

	// store definition
	const storeData = `import { houdiniConfig } from '$houdini';
import { queryStore } from '../runtime/stores'
import artifact from '../artifacts/${artifactName}'
import { defaultConfigValues } from '../runtime/lib'

// create the query store
const factory = () => queryStore({
    artifact,
    config: defaultConfigValues(houdiniConfig),
    storeName: ${JSON.stringify(storeName)},
    paginated: ${JSON.stringify(Boolean(doc.refetch?.paginated))},
    paginationMethods: ${JSON.stringify(paginationExtras.methods, null, 4).replaceAll(
		'\n',
		'\n    '
	)}
})

export const ${storeName} = factory()

export const ${config.storeFactoryName(artifactName)} = factory

export default ${storeName}
`

	// look for the operation
	const operations = doc.document.definitions.filter(
		({ kind }) => kind === graphql.Kind.OPERATION_DEFINITION
	) as graphql.OperationDefinitionNode[]
	const inputs = operations[0]?.variableDefinitions
	const withVariableInputs = inputs && inputs.length > 0
	const VariableInputsType = withVariableInputs ? `${artifactName}$input` : 'null'

	// type definitions
	const typeDefs = `import type { ${artifactName}$input, ${artifactName}$result, CachePolicy } from '$houdini'
import { type QueryStore } from '../runtime/lib/types'
${paginationExtras.typeImports}

export declare const ${storeName}: QueryStore<${artifactName}$result | undefined, ${VariableInputsType}, ${
		paginationExtras.storeExtras
	}> ${paginationExtras.types}

export declare const ${config.storeFactoryName(artifactName)}: () => typeof ${storeName}

export default ${storeName}
`

	await Promise.all([
		writeFile(path.join(config.storesDirectory, `${fileName}.js`), storeData),
		writeFile(path.join(config.storesDirectory, `${fileName}.d.ts`), typeDefs),
	])

	return fileName
}
