import * as graphql from 'graphql'
// locals
import { Config } from '../../common'
import { TransformDocument } from '../types'
import { walkTaggedDocuments } from '../utils'

export default async function moduleProcessorChecker(
	config: Config,
	doc: TransformDocument
): Promise<void> {
	// if there is no module script there is nothing to check
	if (!doc.module) {
		return
	}

	await walkTaggedDocuments(
		config,
		doc,
		doc.module,
		{
			// where only for query & subscription
			where(gqlTag: graphql.DocumentNode) {
				return (
					gqlTag.definitions.length === 1 &&
					gqlTag.definitions[0].kind === graphql.Kind.OPERATION_DEFINITION &&
					(gqlTag.definitions[0].operation === 'query' ||
						gqlTag.definitions[0].operation === 'subscription')
				)
			},
			onTag(operation) {
				throw {
					filepath: doc.filename,
					message: `The operation "${operation.artifact.name}" should not be defined in a context="module".`,
				}
			},
		},
		true
	)
}
