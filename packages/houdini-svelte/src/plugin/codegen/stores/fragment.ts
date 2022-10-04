import { CollectedGraphQLDocument, Config, fs } from 'houdini'
import path from 'path'

import { global_store_name, stores_directory, store_name } from '../../kit'

export async function generateFragmentStore(config: Config, doc: CollectedGraphQLDocument) {
	const fileName = doc.name
	const artifactName = `${doc.name}`
	const storeName = store_name({ config, name: doc.name })
	const globalStoreName = global_store_name({ config, name: doc.name })

	const paginationMethod = doc.refetch?.method

	// in order to build the store, we need to know what class we're going to import from
	let queryClass = 'FragmentStore'
	if (paginationMethod === 'cursor') {
		queryClass =
			doc.refetch?.direction === 'forward'
				? 'FragmentStoreForwardCursor'
				: 'FragmentStoreBackwardCursor'
	} else if (paginationMethod === 'offset') {
		queryClass = 'FragmentStoreOffset'
	}

	// store definition
	const storeContent = `import { ${queryClass} } from '../runtime/stores'
import artifact from '../artifacts/${artifactName}'
${
	paginationMethod
		? `import _PaginationArtifact from '${config.artifactImportPath(
				config.paginationQueryName(doc.name)
		  )}'`
		: ''
}

// create the query store

export class ${storeName} extends ${queryClass} {
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
	const typeDefs = `import type { ${_data}, ${queryClass}, QueryStoreFetchParams} from '$houdini'

export declare class ${storeName} extends ${queryClass}<${_data}, {}> {
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
		fs.writeFile(path.join(stores_directory(config), `${fileName}.d.ts`), typeDefs),
		fs.writeFile(path.join(stores_directory(config), `${fileName}.js`), storeContent),
	])

	// return the store name to the generator so the index file can be created
	return fileName
}
