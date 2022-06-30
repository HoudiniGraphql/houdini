// externals
import * as graphql from 'graphql'
// locals
import { Config } from '../../common'

export function flattenSelections({
	config,
	selections,
	includeFragments,
	parentType,
	fragmentDefinitions,
}: {
	config: Config
	selections: readonly graphql.SelectionNode[]
	includeFragments: boolean
	parentType: graphql.GraphQLCompositeType
	fragmentDefinitions: { [name: string]: graphql.FragmentDefinitionNode }
}): readonly graphql.SelectionNode[] {
	// group the selections by field name, inline fragments
	const fieldMap: { [attributeName: string]: graphql.FieldNode } = {}
	const inlineFragments: { [typeName: string]: graphql.InlineFragmentNode } = {}
	const spreadFragments: { [fragmentName: string]: graphql.FragmentSpreadNode } = {}

	// in order to merge inline fragments into the right thing, we need to add each selection found
	// to the appropriate group and then let the selections get merged with the rest
	const spreads = !includeFragments
		? []
		: selections.filter(({ kind }) => kind === 'FragmentSpread')
	for (const s of spreads) {
		const selection = s as graphql.FragmentSpreadNode
	}

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
		} else if (selection.kind === 'FragmentSpread' && !spreadFragments[selection.name.value]) {
			spreadFragments[selection.name.value] = selection
		}
	}

	return [
		...Object.values(fieldMap).map((field) => ({
			...field,
			selectionSet: field.selectionSet
				? ({
						kind: 'SelectionSet',
						selections: flattenSelections({
							config,
							selections: field.selectionSet?.selections,
							includeFragments,
							fragmentDefinitions,
							parentType: (parentType as
								| graphql.GraphQLObjectType
								| graphql.GraphQLInterfaceType).getFields()[field.name.value].type,
						}),
				  } as graphql.SelectionSetNode)
				: undefined,
		})),
		...Object.values(inlineFragments).map((fragment) => ({
			...fragment,
			selectionSet: {
				kind: 'SelectionSet' as 'SelectionSet',
				selections: flattenSelections({
					config,
					selections: fragment.selectionSet.selections,
					includeFragments,
					fragmentDefinitions,
					parentType: fragment.typeCondition
						? (config.schema.getType(
								fragment.typeCondition.name.value
						  )! as graphql.GraphQLOutputType)
						: parentType,
				}),
			},
		})),
		...Object.values(spreadFragments),
	]
}
