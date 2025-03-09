import type { Document, GenerateHookInput } from 'houdini'
import { fs, path } from 'houdini'

import type { HoudiniSvelteConfig } from '../..'
import { stores_directory, store_name } from '../../kit'
import { store_import } from './custom'

export async function fragmentStore({ config, pluginRoot }: GenerateHookInput, doc: Document) {
	const fileName = doc.name
	const artifactName = `${doc.name}`
	const storeName = store_name({ config, name: doc.name })

	const paginationMethod = doc.refetch?.method

	// in order to build the store, we need to know what class we're going to import from
	let which: keyof Required<HoudiniSvelteConfig>['customStores'] = 'fragment'
	if (paginationMethod === 'cursor') {
		which = 'fragmentCursor'
	} else if (paginationMethod === 'offset') {
		which = 'fragmentOffset'
	}
	const { statement, store_class } = store_import(config, which)

	// store definition
	const storeContent = `${statement}
import artifact from '$houdini/artifacts/${artifactName}'
${
	paginationMethod
		? `import _PaginationArtifact from '${config.artifactImportPath(
				config.paginationQueryName(doc.name)
		  )}'`
		: ''
}

// create the fragment store

export class ${storeName} extends ${store_class} {
	constructor() {
		super({
			artifact,
			storeName: ${JSON.stringify(storeName)},
			variables: ${JSON.stringify(true)},
			${paginationMethod ? 'paginationArtifact: _PaginationArtifact,' : ''}
		})
	}
}
`

	const _data = `${artifactName}$data`
	const _input = `${artifactName}$input`

	// the type definitions for the store
	const typeDefs = `import type { ${_data}, ${_input}, ${store_class}, QueryStoreFetchParams} from '$houdini'

export declare class ${storeName} extends ${store_class}<${_data}, { ${doc.name}: any }, ${_input}> {
	constructor() {
		// @ts-ignore
		super({})
	}
}
`

	// write the store contents to disk
	await Promise.all([
		fs.writeFile(path.join(stores_directory(pluginRoot), `${fileName}.d.ts`), typeDefs),
		fs.writeFile(path.join(stores_directory(pluginRoot), `${fileName}.js`), storeContent),
	])

	// return the store name to the generator so the index file can be created
	return fileName
}
