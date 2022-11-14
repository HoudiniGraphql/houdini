import { CollectedGraphQLDocument, fs, GenerateHookInput, path } from 'houdini'

import { global_store_name, stores_directory, store_name } from '../../kit'
import { store_import } from './custom'

export async function subscriptionStore(
	{ config, plugin_root }: GenerateHookInput,
	doc: CollectedGraphQLDocument
) {
	const fileName = doc.name
	const storeName = store_name({ config, name: doc.name })
	const globalStoreName = global_store_name({ config, name: doc.name })
	const artifactName = `${doc.name}`

	// figure out which store to use
	const { store_class, statement } = store_import(config, 'subscription')

	// the content of the store
	const storeContent = `import artifact from '$houdini/artifacts/${artifactName}'
${statement}

export class ${storeName} extends ${store_class} {
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

	// the type definitions for the store
	const typeDefs = `import type { ${_input}, ${_data}, ${store_class} } from '$houdini'

export declare class ${storeName} extends ${store_class}<${_data} | undefined, ${_input}> {
	constructor() {
		// @ts-ignore
		super({})
	}
}

export const ${globalStoreName}: ${storeName}

export default ${storeName}
`

	// write the store contents to disk
	await Promise.all([
		fs.writeFile(path.join(stores_directory(plugin_root), `${fileName}.d.ts`), typeDefs),
		fs.writeFile(path.join(stores_directory(plugin_root), `${fileName}.js`), storeContent),
	])

	// return the store name to the generator so the index file can be created
	return fileName
}
