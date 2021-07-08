// externals
import * as graphql from 'graphql'
import { Config, parentTypeFromAncestors } from 'houdini-common'
// locals
import { CollectedGraphQLDocument } from '../types'

// paginate transform adds the necessary fields for a paginated field
export default async function paginate(
	config: Config,
	documents: CollectedGraphQLDocument[]
): Promise<void> {
	// visit every document
	for (const doc of documents) {
		// we need to add page info to the selection
		doc.document = graphql.visit(doc.document, {
			Field(node, _, parent, ___, ancestors) {
				// if there's no paginate directive, ignore the field
				const paginateDirective = node.directives?.find(
					(directive) => directive.name.value === config.paginateDirective
				)
				if (!paginateDirective) {
					return
				}

				// look for the parent type
				const parentType = parentTypeFromAncestors(
					config.schema,
					ancestors
				) as graphql.GraphQLObjectType

				const forwardPagination = !!parentType
					.getFields()
					[node.name.value].args.find(
						(arg) => arg.name === 'first' || arg.name === 'after'
					)
				const backwardPagination = !!parentType
					.getFields()
					[node.name.value].args.find(
						(arg) => arg.name === 'first' || arg.name === 'before'
					)
				const cursorPagination = forwardPagination || backwardPagination

				// if the field supports cursor based pagination we need to make sure we have the
				// page info field
				if (!cursorPagination) {
					return
				}
			},
		})
	}
}
