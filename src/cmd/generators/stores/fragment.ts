// externals
import path from 'path'
// locals
import { log, logGreen } from '../../../common/log'
import { Config } from '../../../common'
import { CollectedGraphQLDocument } from '../../types'
import { writeFile } from '../../utils'
import pagination from './pagination'

export async function generateFragmentStore(config: Config, doc: CollectedGraphQLDocument) {
	const storeName = config.storeName(doc)

	const paginationExtras = pagination(config, doc)

	// the content of the store
	const storeContent = `
import { writable } from 'svelte/store'
${paginationExtras.imports}

// a fragment store exists in multiple places in a given application so we 
// can't just return a store directly, the user has to load the version of the 
// fragment store for the object the store has been mixed into
export const ${storeName} = { 
    load(initialValue) {
        // at the moment a fragment store doesn't really do anything 
        // but we're going to keep it wrapped in a store so we can eventually
        // optimize the updates 
        const fragmentStore = writable(initialValue) 

		${paginationExtras.preamble}

        return { 
            subscribe: fragmentStore.subscribe,
            update: fragmentStore.set,
			${paginationExtras.methods}
        }
    }
}
`

	// the type definitions for the store
	const typeDefs = `
import type { Readable } from 'svelte/store'
import type { ${doc.name}$data, ${doc.name} } from '$houdini'

export declare const ${storeName}: Readable<${doc.name}$data> & {
    update: (value: ${doc.name}) => void
} ${paginationExtras.types}
`

	// write the store contents to disk
	await Promise.all([
		writeFile(path.join(config.rootDir, 'stores', `${storeName}.d.ts`), typeDefs),
		writeFile(path.join(config.storesDirectory, `${storeName}.js`), storeContent),
	])

	// notify the user we generated the store
	log.success(`${logGreen(storeName)} fragment store`, { level: 3 })

	// return the store name to the generator so the index file can be created
	return storeName
}
