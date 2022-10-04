import { Config, HoudiniError, CollectedGraphQLDocument } from 'houdini'

import { store_name } from '../plugin/kit'

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
		if (forbiddenNames.includes(store_name({ config, name: doc.name }))) {
			errors.push(
				new HoudiniError({
					filepath: doc.filename,
					message: `Operation name "${doc.name}" forbidden (as Houdini uses "${store_name(
						{
							config,
							name: doc.name,
						}
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
