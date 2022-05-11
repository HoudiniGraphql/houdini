import path from 'path'
import { Config } from '../../../common'
import { ArtifactKind, CollectedGraphQLDocument } from '../../types'
import { writeFile } from '../../utils'
import { generateIndividualStoreQuery } from './storeQuery'
import { log } from '../../../common/log'

export default async function storesGenerator(config: Config, docs: CollectedGraphQLDocument[]) {
	const listOfStores: (string | null)[] = []

	log.info('🎩 Generating Stores...')

	await Promise.all(
		docs.map(async (doc) => {
			if (doc.kind === ArtifactKind.Query) {
				listOfStores.push(await generateIndividualStoreQuery(config, doc))
			} else if (doc.kind === ArtifactKind.Mutation) {
				log.error('Mutation Store => Not implemented yet!')
			} else if (doc.kind === ArtifactKind.Subcription) {
				log.error('Subscription => Not implemented yet!')
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

	log.info('✅ ...Stores generated')
}
