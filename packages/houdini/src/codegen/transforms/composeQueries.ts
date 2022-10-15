import graphql, { Kind as GraphqlKinds } from 'graphql'

import { Config, HoudiniError, CollectedGraphQLDocument } from '../../lib'

export type FragmentDependency = {
	definition: graphql.FragmentDefinitionNode
	requiredFragments: string[]
	document: CollectedGraphQLDocument
}

// includeFragmentDefinitions adds any referenced fragments to operations
export default async function includeFragmentDefinitions(
	config: Config,
	documents: CollectedGraphQLDocument[]
): Promise<void> {
	// we will need to add the same fragment definitions to multiple operations so lets compute
	// a single mapping that we'll reference later from the list of documents
	const fragments = collectFragments(config, documents)

	// visit every document and add any fragment definitions that are missing
	for (const [index, { name, document, filename }] of documents.entries()) {
		// look for the operation in this document
		const operation = document.definitions.find(
			({ kind }) => kind === GraphqlKinds.OPERATION_DEFINITION
		) as graphql.OperationDefinitionNode

		// if there isn't one we don't care about this document
		if (!operation) {
			continue
		}

		// grab the full list of required fragments
		const allFragments = flattenFragments(
			filename,
			{ requiredFragments: findRequiredFragments(operation.selectionSet) },
			fragments
		)

		// add every required fragment to the document
		documents[index].document = {
			...document,
			definitions: [
				operation,
				...allFragments.map((fragmentName) => fragments[fragmentName].definition),
			],
		}
	}
}

export function collectFragments(
	config: Config,
	docs: CollectedGraphQLDocument[]
): Record<string, FragmentDependency> {
	return docs.reduce<{ [name: string]: FragmentDependency }>((acc, doc) => {
		// look for any definitions in this document
		const definitions = doc.document.definitions.reduce(
			(prev, definition) =>
				definition.kind !== 'FragmentDefinition'
					? prev
					: {
							...prev,
							[definition.name.value]: {
								definition,
								requiredFragments: findRequiredFragments(definition.selectionSet),
								document: doc,
							},
					  },
			{}
		)

		// add any definitions we found in this document
		return {
			...acc,
			...definitions,
		}
	}, {})
}

function findRequiredFragments(selectionSet: graphql.SelectionSetNode): Array<string> {
	// if there are no selections in this set
	if (selectionSet.selections.length === 0) {
		return []
	}

	// build up a list of referenced fragments in this selection
	const referencedFragments: string[] = []
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
function flattenFragments(
	filepath: string,
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
			throw new HoudiniError({
				filepath,
				message: 'compose: could not find definition for fragment ' + nextFragment,
			})
		}

		// add this fragments dependents to the pile
		remaining.push(...targetFragment.requiredFragments)
	}

	// we're done
	return [...frags]
}
