import * as graphql from 'graphql'
import path from 'path'
import { Config } from '../../../common'
import { CollectedGraphQLDocument } from '../../types'
import { writeFile } from '../../utils'
import pagination from './pagination'

export async function generateIndividualStoreQuery(config: Config, doc: CollectedGraphQLDocument) {
	const storeData: string[] = []
	const storeDataDTs: string[] = []

	const fileName = doc.name
	const storeName = config.storeName(doc) // "1 => GQL_All$Items" => ${storeName}
	const artifactName = `${doc.name}` // "2 => All$Items" => ${artifactName}

	const paginationExtras = pagination(config, doc)

	// STORE
	const storeDataGenerated = `import { houdiniConfig } from '$houdini';
import { queryStore } from '../runtime/stores'
import { ${artifactName} as artifact } from '../artifacts/${artifactName}'
import { defaultConfigValues } from '../runtime/lib'
// optional pagination imports
${paginationExtras.imports}

const config = defaultConfigValues(houdiniConfig)

${paginationExtras.preamble}

// create the query store
export const ${storeName} = queryStore({
    artifact,
    config,
    extraMethods: ${paginationExtras.methods}
    storeName: ${JSON.stringify(storeName)}
})

export default ${storeName}
`
	storeData.push(storeDataGenerated)
	// STORE END

	// look for the operation
	const operations = doc.document.definitions.filter(
		({ kind }) => kind === graphql.Kind.OPERATION_DEFINITION
	) as graphql.OperationDefinitionNode[]
	const inputs = operations[0]?.variableDefinitions
	const withVariableInputs = inputs && inputs.length > 0
	const VariableInputsType = withVariableInputs ? `${artifactName}$input` : 'null'

	// TYPES
	const storeDataDTsGenerated = `import type { Readable } from 'svelte/store'
import type { ${artifactName}$input, ${artifactName}$result, CachePolicy } from '$houdini'
import { QueryStore } from '../runtime/lib/types'
${paginationExtras.typeImports}

export declare const ${storeName}: QueryStore<${artifactName}$result | undefined, ${VariableInputsType}> ${paginationExtras.types}
  `
	storeDataDTs.push(storeDataDTsGenerated)
	// TYPES END

	await writeFile(path.join(config.rootDir, 'stores', `${fileName}.js`), storeData.join(`\n`))

	await writeFile(
		path.join(config.rootDir, 'stores', `${fileName}.d.ts`),
		storeDataDTs.join(`\n`)
	)

	return fileName
}
