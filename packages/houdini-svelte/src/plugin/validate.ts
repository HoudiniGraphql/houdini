import * as graphql from 'graphql'
import type { Config, Document } from 'houdini'
import { HoudiniError, definitionFromAncestors } from 'houdini'

import { store_name } from './kit'

// uniqueDocumentNames verifies that the documents all have unique names
export async function validate({
	config,
	documents,
}: {
	config: Config
	documents: Document[]
}): Promise<void> {
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

	// build up the list of rules we'll apply to every document
	const rules = (filepath: string) =>
		[...graphql.specifiedRules]
			.filter(
				// remove rules that conflict with houdini
				(rule) =>
					![
						// fragments are defined on their own so unused fragments are a fact of life
						graphql.NoUnusedFragmentsRule,
						// query documents don't contain the fragments they use so we can't enforce
						// that we know every fragment. this is replaced with a more appropriate version
						// down below
						graphql.KnownFragmentNamesRule,
						// some of the documents (ie the injected ones) will contain directive definitions
						// and therefor not be explicitly executable
						graphql.ExecutableDefinitionsRule,
						// list include directives that aren't defined by the schema. this
						// is replaced with a more appropriate version down below
						graphql.KnownDirectivesRule,
						// a few directives such at @arguments and @with don't have static names. this is
						// replaced with a more flexible version below
						graphql.KnownArgumentNamesRule,
					].includes(rule)
			)
			.concat(
				// checkBlockingDirectives
				checkBlockingDirectives(config)
			)

	for (const { filename, document: parsed } of documents) {
		// validate the document
		for (const error of graphql.validate(config.schema, parsed, rules(filename))) {
			errors.push(
				new HoudiniError({
					filepath: filename,
					message: error.message,
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

function checkBlockingDirectives(config: Config) {
	return function (ctx: graphql.ValidationContext): graphql.ASTVisitor {
		return {
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
					ctx.reportError(
						new graphql.GraphQLError(
							`You can't apply both @${config.blockingDirective} and @${config.blockingDisableDirective} at the same time`
						)
					)
					return
				}
			},
		}
	}
}
