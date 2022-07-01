import path from 'path'
import { Config } from '../../../common'
import { ArtifactKind, CollectedGraphQLDocument } from '../../types'
import { writeFile } from '../../utils'
import { generateFragmentStore } from './fragment'
import { generateIndividualStoreMutation } from './mutation'
import { generateIndividualStoreQuery } from './query'
import { generateSubscriptionStore } from './subscription'

export default async function storesGenerator(config: Config, docs: CollectedGraphQLDocument[]) {
	const listOfStores: (string | null)[] = []

	await Promise.all(
		docs.map(async (doc) => {
			// if the doc is not meant to be generated, skip it
			if (!doc.generateStore) {
				return
			}

			if (doc.kind === ArtifactKind.Query) {
				listOfStores.push(await generateIndividualStoreQuery(config, doc))
			} else if (doc.kind === ArtifactKind.Mutation) {
				listOfStores.push(await generateIndividualStoreMutation(config, doc))
			} else if (doc.kind === ArtifactKind.Subcription) {
				listOfStores.push(await generateSubscriptionStore(config, doc))
			} else if (doc.kind === ArtifactKind.Fragment) {
				listOfStores.push(await generateFragmentStore(config, doc))
			}
		})
	)

	const dataIndex = listOfStores
		.filter((c) => c !== null)
		.map((c) => `export * from './${c}'`)
		.join(`\n`)
	await writeFile(path.join(config.rootDir, 'stores', `index.js`), dataIndex)

	const dataIndexDTs = `import type { DataSource } from '$houdini/runtime'

export type Result<DataType> = {
	isFetching: boolean
	partial: boolean
	source?: DataSource | null
	data?: DataType | null
	error?: Error | null
}`

	await writeFile(
		path.join(config.rootDir, 'stores', `index.d.ts`),
		dataIndexDTs + `\n` + dataIndex
	)
}
