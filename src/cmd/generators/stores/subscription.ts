// externals
import path from 'path'
// locals
import { Config } from '../../../common'
import { CollectedGraphQLDocument } from '../../types'
import { writeFile } from '../../utils'

export async function generateSubscriptionStore(config: Config, doc: CollectedGraphQLDocument) {
	const fileName = doc.name
	const storeName = config.storeName(doc) // "1 => GQL_Item$Update" => ${storeName}
	const artifactName = `${doc.name}` // "2 => Item$Update" => ${artifactName}

	// the content of the store
	const storeContent = `import { houdiniConfig } from '$houdini'
import artifact from '../artifacts/${artifactName}'
import { subscriptionStore } from '../runtime/stores'
import { defaultConfigValues } from '../runtime/lib'

export const ${storeName} = subscriptionStore({
    config: defaultConfigValues(houdiniConfig),
	artifact,
})

export default ${storeName}
`

	// the type definitions for the store
	const typeDefs = `
`

	// write the store contents to disk
	await Promise.all([
		writeFile(path.join(config.rootDir, 'stores', `${fileName}.d.ts`), typeDefs),
		writeFile(path.join(config.storesDirectory, `${fileName}.js`), storeContent),
	])

	// return the store name to the generator so the index file can be created
	return fileName
}
