import type { CollectedGraphQLDocument, GenerateHookInput } from 'houdini'
import { fs, path } from 'houdini'

import { stores_directory_name, store_name } from '../../../../../houdini-svelte/src/plugin/kit'
import { global_stores_directory, global_store_name } from '../../kit'

export async function subscriptionStore(
	{ config, plugin_root }: GenerateHookInput,
	doc: CollectedGraphQLDocument
) {
	const fileName = doc.name
	const storeName = store_name({ config, name: doc.name })
	const globalStoreName = global_store_name({ config, name: doc.name })

	// the content of the store
	const storeContent = `import { ${storeName} } from '../../houdini-svelte/${stores_directory_name()}'

export const ${globalStoreName} = new ${storeName}()
`

	// the type definitions for the store
	const typeDefs = `import { ${storeName} } from '../../houdini-svelte/${stores_directory_name()}'

export const ${globalStoreName}: ${storeName}
`

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
