import type { Document, GenerateHookInput } from 'houdini'
import { fs, path } from 'houdini'

import { store_name, stores_directory_name } from '../../../../../houdini-svelte/src/plugin/kit'
import { global_stores_directory, global_store_name } from '../../kit'

// import { store_import } from './custom'

export async function mutationStore({ config, pluginRoot }: GenerateHookInput, doc: Document) {
	const fileName = doc.name
	const storeName = store_name({ config, name: doc.name })
	const globalStoreName = global_store_name({ config, name: doc.name })

	const storeData = `import { ${storeName} } from '../../houdini-svelte/${stores_directory_name()}'

export const ${globalStoreName} = new ${storeName}()`

	// the type definitions for the store
	const typeDefs = `import { ${storeName} } from '../../houdini-svelte/${stores_directory_name()}'

export const ${globalStoreName}: ${storeName}`

	await Promise.all([
		fs.writeFile(path.join(global_stores_directory(pluginRoot), `${fileName}.js`), storeData),
		fs.writeFile(path.join(global_stores_directory(pluginRoot), `${fileName}.d.ts`), typeDefs),
	])

	return fileName
}
