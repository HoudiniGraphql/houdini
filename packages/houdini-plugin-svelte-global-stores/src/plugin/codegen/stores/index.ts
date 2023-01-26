import type { Config, GenerateHookInput } from 'houdini'
import { cleanupFiles, fs, ArtifactKind, path } from 'houdini'

import { global_stores_directory, plugin_config } from '../../kit'
import { fragmentStore } from './fragment'
import { mutationStore } from './mutation'
import { queryStore } from './query'
import { subscriptionStore } from './subscription'

export default async function storesGenerator(input: GenerateHookInput) {
	const { documents, config } = input
	const storesToGenerate = plugin_config(config).storesToGenerate

	const listOfStores: (string | null)[] = []

	await Promise.all(
		documents.map(async (doc) => {
			// if the doc is not meant to be generated, skip it
			if (!doc.generateStore) {
				return
			}

			if (doc.kind === ArtifactKind.Query && storesToGenerate.includes('Query')) {
				listOfStores.push(await queryStore(input, doc))
			} else if (
				doc.kind === ArtifactKind.Mutation &&
				storesToGenerate.includes('Mutation')
			) {
				listOfStores.push(await mutationStore(input, doc))
			} else if (
				doc.kind === ArtifactKind.Subscription &&
				storesToGenerate.includes('Subscription')
			) {
				listOfStores.push(await subscriptionStore(input, doc))
			} else if (
				doc.kind === ArtifactKind.Fragment &&
				storesToGenerate.includes('Fragment')
			) {
				listOfStores.push(await fragmentStore(input, doc))
			}
		})
	)

	const listOfStoresOrdered = listOfStores
		.filter((c) => c !== null)
		.sort((a, b) => (a + '').localeCompare(b + '')) as string[]
	const dataIndex = listOfStoresOrdered.map((c) => `export * from './${c}'`).join(`\n`)
	await fs.writeFile(path.join(global_stores_directory(input.plugin_root), `index.js`), dataIndex)

	const storePath = global_stores_directory(input.plugin_root)

	await fs.writeFile(path.join(storePath, `index.d.ts`), dataIndex)

	// cleanup files that are no more necessary!
	await cleanupFiles(storePath, listOfStoresOrdered)
}
