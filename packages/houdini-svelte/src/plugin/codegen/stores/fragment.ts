import { CollectedGraphQLDocument, fs, GenerateHookInput, path } from 'houdini'

import { HoudiniVitePluginConfig } from '../..'
import { global_store_name, stores_directory, store_name } from '../../kit'
import { store_import } from './custom'

export async function fragmentStore(
	{ config, plugin_root }: GenerateHookInput,
	doc: CollectedGraphQLDocument
) {
	const fileName = doc.name
	const artifactName = `${doc.name}`
	const storeName = store_name({ config, name: doc.name })
	const globalStoreName = global_store_name({ config, name: doc.name })

	const paginationMethod = doc.refetch?.method

	// in order to build the store, we need to know what class we're going to import from
	let which: keyof Required<HoudiniVitePluginConfig>['customStores'] = 'fragment'
	if (paginationMethod === 'cursor') {
		which =
			doc.refetch?.direction === 'forward'
				? 'fragmentForwardsCursor'
				: 'fragmentBackwardsCursor'
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

export const ${globalStoreName} = new ${storeName}()

export default ${globalStoreName}
`

	const _data = `${artifactName}$data`

	// the type definitions for the store
	const typeDefs = `import type { ${_data}, ${store_class}, QueryStoreFetchParams} from '$houdini'

export declare class ${storeName} extends ${store_class}<${_data}, {}> {
	constructor() {
		// @ts-ignore
		super({})
	}
}

export const ${globalStoreName}: ${storeName}

export declare const load_${artifactName}: (params: QueryStoreFetchParams<${_data}, {}>) => Promise<${storeName}>

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
