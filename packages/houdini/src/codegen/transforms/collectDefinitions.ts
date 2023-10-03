import * as graphql from 'graphql'
import { Kind as GraphqlKinds } from 'graphql'

import type { Config, Document } from '../../lib'
import { HoudiniError } from '../../lib'

export type FragmentDependency = {
	definition: graphql.FragmentDefinitionNode
	requiredFragments: string[]
	document: Document
}

// includeFragmentDefinitions adds any referenced fragments to operations
export default async function includeFragmentDefinitions(
	config: Config,
	documents: Document[]
): Promise<void> {
	// we will need to add the same fragment definitions to multiple operations so lets compute
	// a single mapping that we'll reference later from the list of documents
	const fragments = collectDefinitions(config, documents)

	// visit every document and add any fragment definitions that are missing
	for (const [index, { name, document, filename }] of documents.entries()) {
		// look for definition in this document
		const operation = document.definitions.find(
			(def): def is graphql.OperationDefinitionNode | graphql.FragmentDefinitionNode =>
				def.kind === GraphqlKinds.OPERATION_DEFINITION || def.kind === 'FragmentDefinition'
		)

		// if there isn't one we don't care about this document
		if (!operation) {
			continue
		}

		// grab the full list of required fragments
		const allFragments = flattenFragments(
			filename,
			{
				requiredFragments: findRequiredFragments(
					config,
					operation as graphql.FragmentDefinitionNode
				),
			},
			fragments
		)

		// add every required fragment to the document
		// we need the "primary" definition to be first in the list
		// so that fragments can be included
		documents[index].document = {
			...document,
			definitions: [
				operation,
				...allFragments.map((fragmentName) => fragments[fragmentName].definition),
			],
		}
	}
}

export function collectDefinitions(
	config: Config,
	docs: Document[]
): Record<string, FragmentDependency> {
	return docs.reduce<{ [name: string]: FragmentDependency }>((acc, doc) => {
		// look for any definitions in this document
		const definitions = doc.document.definitions.reduce((prev, definition) => {
			return definition.kind !== 'FragmentDefinition'
				? prev
				: {
						...prev,
						[definition.name.value]: {
							definition,
							requiredFragments: findRequiredFragments(config, definition),
							document: doc,
						},
				  }
		}, {})

		// add any definitions we found in this document
		return {
			...acc,
			...definitions,
		}
	}, {})
}

function findRequiredFragments(
	config: Config,
	definition: graphql.FragmentDefinitionNode
): Array<string> {
	// build up a list of referenced fragments in this selection
	const referencedFragments: string[] = []

	// instantiate a typeInfo tracker
	const typeInfo = new graphql.TypeInfo(config.schema)

	// @ts-ignore
	definition.selectionSet = graphql.visit(
		definition,
		graphql.visitWithTypeInfo(typeInfo, {
			// if this selection is a fragment spread
			FragmentSpread(node) {
				// add the name of the referenced fragment
				referencedFragments.push(node.name.value)
			},
		})
	).selectionSet

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
