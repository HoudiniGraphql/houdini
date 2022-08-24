import path from 'path'

import { Config, writeFile } from '../../../common'
import { CollectedGraphQLDocument } from '../../types'

export async function generateIndividualStoreMutation(
	config: Config,
	doc: CollectedGraphQLDocument
) {
	const fileName = doc.name
	const storeName = config.storeName(doc)
	const globalStoreName = config.globalStoreName(doc)
	const artifactName = `${doc.name}`

	// store content
	const storeData = `import artifact from '../artifacts/${artifactName}'
import { MutationStore } from '../runtime/stores'

export class ${storeName} extends MutationStore {
	constructor() {
		super({
			artifact,
		})
	}
}

export const ${globalStoreName} = new ${storeName}()

export default ${globalStoreName}
`

	// type definitions
	const typeDefs = `import type { ${artifactName}$input, ${artifactName}$result, MutationStore } from '$houdini'

export declare class ${storeName} extends MutationStore<${artifactName}$result | undefined, ${artifactName}$input>{
	constructor() {}
}

export const ${globalStoreName}: ${storeName}

export default ${storeName}
  `

	await Promise.all([
		writeFile(path.join(config.storesDirectory, `${fileName}.js`), storeData),
		writeFile(path.join(config.storesDirectory, `${fileName}.d.ts`), typeDefs),
	])

	return fileName
}
