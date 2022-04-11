// locals
import { Config } from '~/common'
import { CollectedGraphQLDocument, HoudiniInfoError } from '../types'

// uniqueDocumentNames verifies that the documents all have unique names
export default async function uniqueDocumentNames(
	config: Config,
	docs: CollectedGraphQLDocument[]
): Promise<void> {
	// build up a list of document names
	const nameMap = docs.reduce<{ [docName: string]: string[] }>(
		(acc, { name, filename }) => ({
			...acc,
			[name]: [...(acc[name] || []), filename],
		}),
		{}
	)

	// look for names with more than one entry and turn them into errors
	const errors: HoudiniInfoError[] = Object.entries(nameMap)
		.filter(([_, filenames]) => filenames.length > 1)
		.map(([docName, fileNames]) => ({
			message: 'Encountered conflict in document names',
			description: fileNames,
		}))

	// if we got errors
	if (errors.length > 0) {
		throw errors
	}

	// we're done here
	return
}
