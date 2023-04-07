import * as graphql from 'graphql'
import type { Config, Document } from 'houdini'
import { HoudiniError, definitionFromAncestors } from 'houdini'

import { store_name } from './kit'

// const directivesErrors: HoudiniError[] = []

// uniqueDocumentNames verifies that the documents all have unique names
export async function validate({
	config,
	documents,
}: {
	config: Config
	documents: Document[]
}): Promise<void> {
	// Validation 1
	// all forbiddenNames
	const forbiddenNames = [
		'QueryStore',
		'MutationStore',
		'SubscriptionStore',
		'FragmentStore',
		'BaseStore',
	]

	const errors: HoudiniError[] = []

	for (let i = 0; i < documents.length; i++) {
		const doc = documents[i]
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

	// Validation 2
	// Blocking directives
	for (const { filename, document: parsed } of documents) {
		// validate the document
		graphql.visit(parsed, {
			Directive(node, _, __, ___, ancestors) {
				const blockingDirectives = [
					config.blockingDirective,
					config.blockingDisableDirective,
				]

				// If we don't have blockingDirectives, let's go out
				if (!blockingDirectives.includes(node.name.value)) {
					return
				}

				// get definition
				const { definition } = definitionFromAncestors(ancestors)

				// list directives
				const listDirective = definition.directives?.map((c) => c.name.value) ?? []

				// if we have both blocking and no blocking directives let's report an error
				if (
					listDirective.includes(config.blockingDirective) &&
					listDirective.includes(config.blockingDisableDirective)
				) {
					errors.push(
						new HoudiniError({
							filepath: filename,
							message: `You can't apply both @${config.blockingDirective} and @${config.blockingDisableDirective} at the same time`,
						})
					)
				}

				return
			},
		})
	}

	if (errors.length > 0) {
		throw errors
	}

	// we're done here
	return
}
