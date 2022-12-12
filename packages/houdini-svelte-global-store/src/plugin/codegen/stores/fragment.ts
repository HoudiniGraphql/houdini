import { CollectedGraphQLDocument, fs, GenerateHookInput, path } from 'houdini'

import { global_store_name, global_stores_directory, store_name } from '../../kit'

export async function fragmentStore(
	{ config, plugin_root }: GenerateHookInput,
	doc: CollectedGraphQLDocument
) {
	const fileName = doc.name
	const artifactName = `${doc.name}`
	const storeName = store_name({ config, name: doc.name })
	const globalStoreName = global_store_name({ config, name: doc.name })

	// store definition
	const storeContent = `// import...

export const ${globalStoreName} = new ${storeName}()
`

	// the type definitions for the store
	const typeDefs = `export const ${globalStoreName}: ${storeName}`

	// write the store contents to disk
	await Promise.all([
		fs.writeFile(path.join(global_stores_directory(plugin_root), `${fileName}.d.ts`), typeDefs),
		fs.writeFile(
			path.join(global_stores_directory(plugin_root), `${fileName}.js`),
			storeContent
		),
	])

	// return the store name to the generator so the index file can be created
	return fileName
}
