import { CollectedGraphQLDocument, Config, fs } from 'houdini'
import path from 'path'

import { global_store_name, stores_directory, store_name } from '../../kit'

export async function generateIndividualStoreMutation(
	config: Config,
	doc: CollectedGraphQLDocument
) {
	const fileName = doc.name
	const storeName = store_name({ config, name: doc.name })
	const globalStoreName = global_store_name({ config, name: doc.name })
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

	const _input = `${artifactName}$input`
	const _data = `${artifactName}$result`
	const _optimistic = `${artifactName}$optimistic`

	// the type definitions for the store
	const typeDefs = `import type { ${_input}, ${_data}, ${_optimistic}, MutationStore } from '$houdini'

export declare class ${storeName} extends MutationStore<${_data} | undefined, ${_input}, ${_optimistic}>{
	constructor() {
		// @ts-ignore
		super({})
	}
}

export const ${globalStoreName}: ${storeName}

export default ${storeName}
  `

	await Promise.all([
		fs.writeFile(path.join(stores_directory(config), `${fileName}.js`), storeData),
		fs.writeFile(path.join(stores_directory(config), `${fileName}.d.ts`), typeDefs),
	])

	return fileName
}
