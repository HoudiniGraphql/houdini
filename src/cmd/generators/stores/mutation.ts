import path from 'path'
import { Config } from '../../../common'
import { CollectedGraphQLDocument } from '../../types'
import { writeFile } from '../../utils'

export async function generateIndividualStoreMutation(
	config: Config,
	doc: CollectedGraphQLDocument
) {
	const storeData: string[] = []
	const storeDataDTs: string[] = []

	const fileName = doc.name
	const storeName = config.storeName(doc) // "1 => GQL_Add$Item" => ${storeName}
	const artifactName = `${doc.name}` // "2 => Add$Item" => ${artifactName}

	// STORE
	const storeDataGenerated = `import { houdiniConfig } from '$houdini'
import { ${artifactName} as artifact } from '../artifacts/${artifactName}'
import { mutationStore } from '../stores'

export const ${storeName} = mutationStore({
	config: houdiniConfig,
	artifact,
})

export default ${storeName}
`
	storeData.push(storeDataGenerated)
	// STORE END

	// TYPES
	const storeDataDTsGenerated = `import type { ${artifactName}$input, ${artifactName}$result } from '$houdini'
import type { MutationStore } from '../runtime/types'

export declare const ${storeName}: MutationStore<${artifactName}$result | undefined, ${artifactName}$input>
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
