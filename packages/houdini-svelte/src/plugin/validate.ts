import * as graphql from 'graphql'
import type { Config, Document } from 'houdini'
import { HoudiniError, definitionFromAncestors } from 'houdini'

import { store_name } from './storeConfig'

// const directivesErrors: HoudiniError[] = []

// uniqueDocumentNames verifies that the documents all have unique names
export async function validate({
	config,
	documents,
}: {
	config: Config
	documents: Document[]
}): Promise<void> {
	const errors: HoudiniError[] = []

	// all forbiddenNames
	const forbiddenNames = [
		'QueryStore',
		'MutationStore',
		'SubscriptionStore',
		'FragmentStore',
		'BaseStore',
	]

	for (const doc of documents) {
		// Validation => Names
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
		throw errors
	}

	// we're done here
	return
}
