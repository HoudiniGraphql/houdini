import type { Config, CollectedGraphQLDocument } from '../../lib'
import { HoudiniError } from '../../lib/error'

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
	const errors: HoudiniError[] = Object.entries(nameMap)
		.filter(([_, filenames]) => filenames.length > 1)
		.map(
			([docName, fileNames]) =>
				new HoudiniError({
					message: fileNames.join(', '),
					description: `Operation names must be unique. Encountered duplicate definitions of ${docName} in these files:`,
				})
		)

	// if we got errors
	if (errors.length > 0) {
		throw new HoudiniError({
			filepath: errors[0].description,
			message: errors[0].message,
		})
	}

	// we're done here
	return
}
