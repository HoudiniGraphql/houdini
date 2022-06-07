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
	const fileName = doc.name

	const paginationExtras = pagination(config, doc)

	// the content of the store
	const storeContent = `import { houdiniConfig } from '$houdini'
import { defaultConfigValues } from '../runtime/config'
import { fragmentStore } from '../runtime/stores'
import { writable } from 'svelte/store'
${paginationExtras.imports}

const config = defaultConfigValues(houdiniConfig)

${paginationExtras.preamble}

export const ${storeName} = fragmentStore({
    artifact,
    config,
    extraMethods: ${paginationExtras.methods}
})

export default ${storeName}
`

	// the type definitions for the store
	const typeDefs = `
import type { Readable } from 'svelte/store'
import type { ${doc.name}$data, ${doc.name} } from '$houdini'
${paginationExtras.typeImports}

export declare const ${storeName}: Readable<${doc.name}$data> & {
    load: (value: ${doc.name}) => void
} ${paginationExtras.types}
`

	// write the store contents to disk
	await Promise.all([
		writeFile(path.join(config.rootDir, 'stores', `${fileName}.d.ts`), typeDefs),
		writeFile(path.join(config.storesDirectory, `${fileName}.js`), storeContent),
	])

	// return the store name to the generator so the index file can be created
	return fileName
}
