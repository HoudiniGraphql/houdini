// externals
import { Config, parentTypeFromAncestors } from 'houdini-common'
import * as graphql from 'graphql'
// locals
import { CollectedGraphQLDocument } from '../types'
import { unwrapType } from '../utils'

// typename adds __typename to the selection set of any unions or interfaces
export default async function addTypename(
	config: Config,
	documents: CollectedGraphQLDocument[]
): Promise<void> {
	// visit every document
	for (const doc of documents) {
		// update the document (graphql.visit is pure)
		doc.document = graphql.visit(doc.document, {
			Field(node): graphql.ASTNode | undefined {
				// if we are looking at a leaf type
				if (!node.selectionSet) {
					return
				}

				// add the __typename selection to the field's selection set
				return {
					...node,
					selectionSet: {
						...node.selectionSet,
						selections: [
							...node.selectionSet.selections,
							{
								kind: 'Field',
								name: {
									kind: 'Name',
									value: '__typename',
								},
							},
						],
					},
				}
			},
		})
	}
}
