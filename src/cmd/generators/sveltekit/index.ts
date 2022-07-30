import { Config } from '../../../common'
import { CollectedGraphQLDocument } from '../../types'

export default async function sveltekitGenerator(config: Config, docs: CollectedGraphQLDocument[]) {
	// we will only generate things if the project is using svelte kit
	if (config.framework !== 'kit') {
		return
	}

	// a file can have multiple documents in it so we need to first group by filename
	const byFilename = docs.reduce<{ [filename: string]: CollectedGraphQLDocument[] }>(
		(prev, doc) => ({
			...prev,
			[doc.filename]: [...(prev[doc.filename] || []), doc],
		}),
		{}
	)

	const routes = Object.keys(byFilename).filter((filename) => config.isRoute(filename, ''))

	// process every route we run into
	await Promise.all(
		routes.map(async (filename) => {
			// we need to generate a data file that loads every document in the route

			// grab the documents for the route
			const docs = byFilename[filename]

			console.log(filename)
		})
	)
}
