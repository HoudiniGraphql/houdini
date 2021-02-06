// externals
import graphql, { visit as walkGraphQL, Kind as GraphqlKinds } from 'graphql'
import { Config } from 'houdini-common'
// locals
import { CollectedGraphQLDocument } from '../types'

// includeFragmentDefinitions adds any referenced fragments to operations
export default async function includeFragmentDefinitions(
	config: Config,
	documents: CollectedGraphQLDocument[]
): Promise<void> {
	// fragments can depend on each other so we need to first find the dependency graph of fragments
	// and then we can add every necessary fragment defintion to the operations
	const documentsByName: {
		[name: string]: CollectedGraphQLDocument & { requiredFragments: string[]; index: number }
	} = documents.reduce((acc, { name, document }, index) => {
		// a document can contain muliple definitions, all of which could require fragments
		const requiredFragments = document.definitions.flatMap((definition) => {
			// if we are looking at an operation or fragment definition
			if (
				definition.kind === GraphqlKinds.OPERATION_DEFINITION ||
				definition.kind === GraphqlKinds.FRAGMENT_DEFINITION
			) {
				return findRequiredFragments(definition.selectionSet)
			}
			// otherwise we dont care about this definition
			return []
		})

		return {
			...acc,
			[name]: {
				document,
				// add the required fragments to the definition
				requiredFragments,
				index,
			},
		}
	}, {})

	// every operation in the list needs to have their required fragments added to their definition
	for (const name of Object.keys(documentsByName)) {
		const document = documentsByName[name]
		// we need to find the complete list of fragments that this document depends on
		const allFragments = flattenFragments(document, documentsByName)

		// add any definitions found in the documents associated with the related fragments
		documents[document.index].document = walkGraphQL(document.document, {
			enter: {
				[GraphqlKinds.DOCUMENT](node) {
					// if there are operations in this document
					if (
						node.definitions.find(
							({ kind }) => kind === GraphqlKinds.OPERATION_DEFINITION
						)
					) {
						// we need to add every necessary fragment definition
						return {
							...node,
							definitions: [
								...node.definitions,
								...allFragments.flatMap(
									(fragmentName) =>
										documentsByName[fragmentName].document.definitions
								),
							],
						}
					}
				},
			},
		})
	}
}

function findRequiredFragments(selectionSet: graphql.SelectionSetNode): Array<string> {
	// if there are no selections in this set
	if (selectionSet.selections.length === 0) {
		return []
	}

	// build up a list of referenced fragments in this selection
	const referencedFragments = []
	for (const selection of selectionSet.selections) {
		// if this selection is a fragment spread
		if (selection.kind === GraphqlKinds.FRAGMENT_SPREAD) {
			// add the name of the referenced fragment
			referencedFragments.push(selection.name.value)
			// if this is something with a subselection
		} else if (selection.selectionSet) {
			// add the referenced fragments in the selection
			referencedFragments.push(...findRequiredFragments(selection.selectionSet))
		}
	}

	// we're done
	return referencedFragments
}

// take a list of required fragments and turn it into a list of fragments
// needed to create the query document
export function flattenFragments(
	operation: { requiredFragments: Array<string> },
	fragments: { [name: string]: { requiredFragments: Array<string> } }
): Array<string> {
	// the list of fragments to return
	const frags = new Set<string>()

	// we're going to do this breadth-first to avoid creating
	// duplicates. If we did this a depth-first we would process dependent
	// fragments after we check if we've already processed this node

	// the list of fragments we still have to process
	const remaining = [...operation.requiredFragments]

	// make sure we hit every node
	while (remaining.length > 0) {
		// grab the fragment we are going to add
		const nextFragment = remaining.shift()

		// make sure we got something
		if (!nextFragment) {
			continue
		}

		// if we haven't seen this fragment before we need to add it to the pile
		if (!frags.has(nextFragment)) {
			frags.add(nextFragment)
		}
		// we have seen this value already
		else {
			continue
		}

		// grab the referenced fragment
		const targetFragment = fragments[nextFragment]
		if (!targetFragment) {
			throw new Error('Could not find definition for fragment ' + nextFragment)
		}

		// add this framgnets dependents to the pile
		remaining.push(...targetFragment.requiredFragments)
	}

	// we're done
	return [...frags]
}
