import { Config, HoudiniError } from '../../common'
import { CollectedGraphQLDocument } from '../types'

// uniqueDocumentNames verifies that the documents all have unique names
export default async function forbiddenNames(
	config: Config,
	docs: CollectedGraphQLDocument[]
): Promise<void> {
	// all forbiddenNames
	const forbiddenNames = [
		'QueryStore',
		'MutationStore',
		'SubscriptionStore',
		'FragmentStore',
		'BaseStore',
	]

	const errors: HoudiniError[] = []

	for (let i = 0; i < docs.length; i++) {
		const doc = docs[i]
		if (forbiddenNames.includes(config.storeName(doc))) {
			errors.push(
				new HoudiniError({
					filepath: doc.filename,
					message: `Operation name "${
						doc.name
					}" forbidden (as Houdini uses "${config.storeName(
						doc
					)}" internally), please change it to something else.`,
				})
			)
		}
	}

	if (errors.length > 0) {
		throw new HoudiniError({
			filepath: errors[0].filepath,
			message: errors[0].message,
		})
	}

	// we're done here
	return
}
