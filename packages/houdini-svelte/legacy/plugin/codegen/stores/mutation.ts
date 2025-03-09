import type { Document, GenerateHookInput } from 'houdini'
import { fs, path } from 'houdini'

import { stores_directory, store_name } from '../../kit'
import { store_import } from './custom'

export async function mutationStore({ config, pluginRoot }: GenerateHookInput, doc: Document) {
	const fileName = doc.name
	const storeName = store_name({ config, name: doc.name })
	const artifactName = `${doc.name}`
	const { statement, store_class } = store_import(config, 'mutation')

	// store content
	const storeData = `import artifact from '$houdini/artifacts/${artifactName}'
${statement}

export class ${storeName} extends ${store_class} {
	constructor() {
		super({
			artifact,
		})
	}
}
`

	const _input = `${artifactName}$input`
	const _data = `${artifactName}$result`
	const _optimistic = `${artifactName}$optimistic`

	// the type definitions for the store
	const typeDefs = `import type { ${_input}, ${_data}, ${_optimistic}, ${store_class} } from '$houdini'

export declare class ${storeName} extends ${store_class}<${_data}, ${_input}, ${_optimistic}>{
	constructor() {
		// @ts-ignore
		super({})
	}
}
  `

	await Promise.all([
		fs.writeFile(path.join(stores_directory(pluginRoot), `${fileName}.js`), storeData),
		fs.writeFile(path.join(stores_directory(pluginRoot), `${fileName}.d.ts`), typeDefs),
	])

	return fileName
}
