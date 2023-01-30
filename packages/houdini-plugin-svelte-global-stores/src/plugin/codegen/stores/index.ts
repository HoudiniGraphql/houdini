import type { GenerateHookInput } from 'houdini'
import { ArtifactKind, cleanupFiles, fs, path } from 'houdini'

import { global_stores_directory, plugin_config } from '../../kit'
import { fragmentStore } from './fragment'
import { mutationStore } from './mutation'
import { queryStore } from './query'
import { subscriptionStore } from './subscription'

const is_store_needed = (
	kindExpected: ArtifactKind,
	kindDocument: ArtifactKind,
	storesToGenerate: ('query' | 'mutation' | 'subscription' | 'fragment')[] | 'all'
) => {
	if (kindExpected === kindDocument) {
		// build association between ArtifactKind and Literal
		const kindLiteral: Record<
			ArtifactKind,
			'query' | 'mutation' | 'subscription' | 'fragment'
		> = {
			HoudiniQuery: 'query',
			HoudiniMutation: 'mutation',
			HoudiniSubscription: 'subscription',
			HoudiniFragment: 'fragment',
		}

		if (storesToGenerate === 'all' || storesToGenerate.includes(kindLiteral[kindExpected])) {
			return true
		}
	}
	return false
}

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

			if (is_store_needed(ArtifactKind.Query, doc.kind, storesToGenerate)) {
				listOfStores.push(await queryStore(input, doc))
			} else if (is_store_needed(ArtifactKind.Mutation, doc.kind, storesToGenerate)) {
				listOfStores.push(await mutationStore(input, doc))
			} else if (is_store_needed(ArtifactKind.Subscription, doc.kind, storesToGenerate)) {
				listOfStores.push(await subscriptionStore(input, doc))
			} else if (is_store_needed(ArtifactKind.Fragment, doc.kind, storesToGenerate)) {
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
