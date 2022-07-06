// locals
import { Config } from '../../common'
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
			message: `Operation "${docName}" conflict. It should not be defined in multiple places!`,
			description: fileNames,
		}))

	// if we got errors
	if (errors.length > 0) {
		throw { filepath: errors[0].description?.join(' | '), message: errors[0].message }
	}

	// we're done here
	return
}
