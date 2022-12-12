import { CollectedGraphQLDocument, fs, GenerateHookInput, path } from 'houdini'

import { global_stores_directory, global_store_name, store_name } from '../../kit'

export async function queryStore(
	{ config, plugin_root }: GenerateHookInput,
	doc: CollectedGraphQLDocument
) {
	const fileName = doc.name
	const artifactName = `${doc.name}`
	const storeName = store_name({ config, name: doc.name })
	const globalStoreName = global_store_name({ config, name: doc.name })

	// store definition
	// const { store_class, statement } = store_import(config, which)
	const storeData = `// import 

export const ${globalStoreName} = new ${storeName}()`

	// const _input = `${artifactName}$input`
	// const _data = `${artifactName}$result`

	// the type definitions for the store
	const typeDefs = `// import ...

export const ${globalStoreName}: ${storeName}`

	await Promise.all([
		fs.writeFile(path.join(global_stores_directory(plugin_root), `${fileName}.js`), storeData),
		fs.writeFile(path.join(global_stores_directory(plugin_root), `${fileName}.d.ts`), typeDefs),
	])

	return fileName
}
