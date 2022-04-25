import path from 'path'
import { Config } from '../../../common'
import { CollectedGraphQLDocument } from '../../types'
import { writeFile } from '../../utils'
import { generateIndividualStore } from './store'

export default async function storesGenerator(config: Config, docs: CollectedGraphQLDocument[]) {
	const listOfStores: (string | null)[] = []

	await Promise.all(
		docs.map(async (doc) => {
			listOfStores.push(await generateIndividualStore(config, doc))
		})
	)

	const dataIndex = listOfStores
		.filter((c) => c !== null)
		.map((c) => `export * from './${c}'`)
		.join(`\n`)
	await writeFile(path.join(config.rootDir, 'stores', `index.js`), dataIndex)

	const dataIndexDTs = `export type Result<DataType> = {
	from: 'CACHE' | 'NETWORK'
	data?: DataType
}`
	await writeFile(path.join(config.rootDir, 'stores', `index.d.ts`), dataIndexDTs)

	console.log('✅ Stores')
}
