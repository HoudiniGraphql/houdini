import { Config } from '../../../common'
import { CollectedGraphQLDocument } from '../../types'
import { readFile } from '../../utils'
import { writeFile } from 'fs-extra'

export default async function sveltekitGenerator(config: Config, docs: CollectedGraphQLDocument[]) {
	// we will only generate things if the project is using svelte kit
	if (config.framework !== 'kit') {
		return
	}

	// a file can have multiple documents in it so we need to first group by filename
	const byFilename = docs.reduce<{ [filename: string]: CollectedGraphQLDocument[] }>(
		(prev, doc) => {
			// if the doc is not a user generated store, skip it
			if (!doc.generateStore) {
				return prev
			}

			const old = prev[doc.filename] || []
			return {
				...prev,
				[doc.filename]: [...old, doc],
			}
		},
		{}
	)

	const routes = Object.entries(byFilename)
		.filter(([filename, doc]) => config.isRoute(filename, ''))
		.map(([route]) => route)

	// process every route we run into
	await Promise.all(
		routes.map(async (filename) => {
			// the actual loading logic will be handled by a plugin's transform so all we have to do
			// is make sure that the data file exists
			const dataFilePath = config.routeDataPath(filename)
			const dataFileContents = await readFile(dataFilePath)

			// if the file does not exist, create it
			if (!dataFileContents) {
				await writeFile(
					dataFilePath,
					'// This file cannot contain a load function. Jean-Yves will have better content to put here:D'
				)
			}
		})
	)
}
