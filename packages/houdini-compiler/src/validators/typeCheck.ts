// externals
import { Config, HoudiniDocumentError } from 'houdini-common'
import * as graphql from 'graphql'
import { NoUnusedFragments } from 'graphql/validation/rules/NoUnusedFragments'
import { KnownFragmentNames } from 'graphql/validation/rules/KnownFragmentNames'
// locals
import { CollectedGraphQLDocument } from '../types'

// typeCheck verifies that the documents are valid instead of waiting
// for the compiler to fail later down the line
export default async function typeCheck(
	config: Config,
	docs: CollectedGraphQLDocument[]
): Promise<void> {
	// wrap the errors we run into in a HoudiniError
	const errors: HoudiniDocumentError[] = []

	for (const { filename, document: parsed } of docs) {
		// build up a list of the rules we want to validate with
		const validateRules = [...graphql.specifiedRules].filter(
			// remove the rules that conflict with houdini
			(rule) => [NoUnusedFragments, KnownFragmentNames].indexOf(rule) === -1
		)

		// validate the document
		for (const error of graphql.validate(config.schema, parsed, validateRules)) {
			errors.push({
				...error,
				filepath: filename,
			})
		}
	}

	// if we got errors
	if (errors.length > 0) {
		throw errors
	}

	// we're done here
	return
}
