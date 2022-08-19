import path from 'path'

import { Config, writeFile } from '../../../common'
import { CollectedGraphQLDocument } from '../../types'

export async function generateIndividualStoreMutation(
	config: Config,
	doc: CollectedGraphQLDocument
) {
	const fileName = doc.name
	const storeName = config.globalStoreName(doc)
	const artifactName = `${doc.name}`

	// store content
	const storeData = `import artifact from '../artifacts/${artifactName}'
import { mutationStore } from '../runtime/stores'

export const ${storeName} = mutationStore({
	artifact,
})

export default ${storeName}
`

	// type definitions
	const typeDefs = `import type { ${artifactName}$input, ${artifactName}$result } from '$houdini'
import type { MutationStore } from '../runtime/lib/types'

export declare const ${storeName}: MutationStore<${artifactName}$result | undefined, ${artifactName}$input>

export default ${storeName}
  `

	await Promise.all([
		writeFile(path.join(config.storesDirectory, `${fileName}.js`), storeData),
		writeFile(path.join(config.storesDirectory, `${fileName}.d.ts`), typeDefs),
	])

	return fileName
}
