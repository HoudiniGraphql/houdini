import { CollectedGraphQLDocument, fs, GenerateHookInput, path } from 'houdini'

import { global_stores_directory, global_store_name, store_name } from '../../kit'

// import { store_import } from './custom'

export async function mutationStore(
	{ config, plugin_root }: GenerateHookInput,
	doc: CollectedGraphQLDocument
) {
	const fileName = doc.name
	const storeName = store_name({ config, name: doc.name })
	const globalStoreName = global_store_name({ config, name: doc.name })
	// const artifactName = `${doc.name}`
	// const { statement, store_class } = store_import(config, 'mutation')

	// store content
	const storeData = `// import...

export const ${globalStoreName} = new ${storeName}()`

	// the type definitions for the store
	const typeDefs = `// import...

export const ${globalStoreName}: ${storeName}`

	await Promise.all([
		fs.writeFile(path.join(global_stores_directory(plugin_root), `${fileName}.js`), storeData),
		fs.writeFile(path.join(global_stores_directory(plugin_root), `${fileName}.d.ts`), typeDefs),
	])

	return fileName
}
