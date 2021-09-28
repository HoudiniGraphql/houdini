// externals
import * as graphql from 'graphql'
import { Config } from 'houdini-common'
// locals
import { CollectedGraphQLDocument } from '..'
import { ArtifactKind } from '../../runtime/types'

// flattenSelections turns every documents selection into a single flat object (merging selections and de-duping fields)
export default async function flattenSelections(
	config: Config,
	documents: CollectedGraphQLDocument[]
): Promise<void> {
	for (const doc of documents) {
		// figure out the primary document
		const primary = doc.document.definitions.find(
			(defn) =>
				(defn.kind === 'FragmentDefinition' || defn.kind === 'OperationDefinition') &&
				defn.name?.value === doc.name
		) as graphql.FragmentDefinitionNode | graphql.OperationDefinitionNode
		// if we couldn't find the primary, skip it
		if (!primary) {
			continue
		}

		doc.selections = _flatten({
			config,
			selections: primary.selectionSet.selections,
			includeFragments: doc.kind !== ArtifactKind.Fragment,
		})
	}
}
function _flatten({
	config,
	selections,
	includeFragments,
}: {
	config: Config
	selections: readonly graphql.SelectionNode[]
	includeFragments: boolean
}): readonly graphql.SelectionNode[] {
	// group the selections by field name, inline fragments
	const fieldMap: { [attributeName: string]: graphql.FieldNode } = {}
	const inlineFragments: { [typeName: string]: graphql.InlineFragmentNode } = {}

	// look at every selection
	for (const selection of selections) {
		// the selection could be a field
		if (selection.kind === 'Field') {
			const attributeName = selection.alias?.value || selection.name?.value
			// if we haven't seen the field before
			if (!fieldMap[attributeName]) {
				// add the field to the map
				fieldMap[attributeName] = selection
				// move on
				continue
			}

			// we've seen the field before

			// if the field doesn't have a selection we can move on
			if (!selection.selectionSet) {
				continue
			}

			// we have a field that we've seen before with a selection set
			// add this fields selection set to the field we've already seen
			fieldMap[attributeName] = {
				...fieldMap[attributeName],
				selectionSet: {
					...inlineFragments[attributeName]?.selectionSet,
					selections: [
						...(fieldMap[attributeName]?.selectionSet?.selections || []),
						...selection.selectionSet.selections,
					],
				},
			}
		}
		// the selection could be an inline fragment
		else if (selection.kind === 'InlineFragment') {
			const typeCondition = selection.typeCondition?.name.value || ''
			// if we haven't seen the type yet
			if (!inlineFragments[typeCondition]) {
				inlineFragments[typeCondition] = selection
			}
			// we've seen the type condition before, add the selection to the inline fragment
			else {
				inlineFragments[typeCondition] = {
					...inlineFragments[typeCondition],
					selectionSet: {
						...inlineFragments[typeCondition].selectionSet,
						selections: [
							...inlineFragments[typeCondition].selectionSet.selections,
							...selection.selectionSet.selections,
						],
					},
				}
			}
		}
	}

	return [
		...Object.values(fieldMap).map((field) => ({
			...field,
			selectionSet: field.selectionSet
				? ({
						kind: 'SelectionSet',
						selections: _flatten({
							config,
							includeFragments,
							selections: field.selectionSet?.selections,
						}),
				  } as graphql.SelectionSetNode)
				: undefined,
		})),
		...Object.values(inlineFragments).map((fragment) => ({
			...fragment,
			selectionSet: {
				kind: 'SelectionSet' as 'SelectionSet',
				selections: _flatten({
					config,
					includeFragments,
					selections: fragment.selectionSet.selections,
				}),
			},
		})),
	]
}
