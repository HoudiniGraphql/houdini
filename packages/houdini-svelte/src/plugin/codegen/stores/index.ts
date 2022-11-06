import { cleanupFiles, fs, ArtifactKind, GenerateHookInput, path } from 'houdini'

import { stores_directory } from '../../kit'
import { fragmentStore } from './fragment'
import { mutationStore } from './mutation'
import { queryStore } from './query'
import { subscriptionStore } from './subscription'

export default async function storesGenerator(input: GenerateHookInput) {
	const { config, documents } = input

	const listOfStores: (string | null)[] = []

	await Promise.all(
		documents.map(async (doc) => {
			// if the doc is not meant to be generated, skip it
			if (!doc.generateStore) {
				return
			}

			if (doc.kind === ArtifactKind.Query) {
				listOfStores.push(await queryStore(input, doc))
			} else if (doc.kind === ArtifactKind.Mutation) {
				listOfStores.push(await mutationStore(input, doc))
			} else if (doc.kind === ArtifactKind.Subscription) {
				listOfStores.push(await subscriptionStore(input, doc))
			} else if (doc.kind === ArtifactKind.Fragment) {
				listOfStores.push(await fragmentStore(input, doc))
			}
		})
	)

	const listOfStoresOrdered = listOfStores
		.filter((c) => c !== null)
		.sort((a, b) => (a + '').localeCompare(b + '')) as string[]
	const dataIndex = listOfStoresOrdered.map((c) => `export * from './${c}'`).join(`\n`)
	await fs.writeFile(path.join(stores_directory(input.plugin_root), `index.js`), dataIndex)

	const dataIndexDTs = `import type { DataSource } from '$houdini/runtime'

export type Result<DataType> = {
	isFetching: boolean
	partial: boolean
	source?: DataSource | null
	data?: DataType | null
	error?: Error | null
}`

	const storePath = stores_directory(input.plugin_root)

	await fs.writeFile(path.join(storePath, `index.d.ts`), dataIndexDTs + `\n` + dataIndex)

	// cleanup files that are no more necessary!
	await cleanupFiles(storePath, listOfStoresOrdered)
}
