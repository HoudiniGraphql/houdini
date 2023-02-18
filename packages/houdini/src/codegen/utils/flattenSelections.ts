import type graphql from 'graphql'

import type { Config } from '../../lib'
import { HoudiniError } from '../../lib'

export function flattenSelections({
	config,
	filepath,
	selections,
	fragmentDefinitions,
	ignoreMaskDisable,
}: {
	config: Config
	filepath: string
	selections: readonly graphql.SelectionNode[]
	fragmentDefinitions: { [name: string]: graphql.FragmentDefinitionNode }
	ignoreMaskDisable?: boolean
}): readonly graphql.SelectionNode[] {
	// collect all of the fields together
	const fields = new FieldCollection({
		config,
		filepath,
		selections,
		fragmentDefinitions,
		ignoreMaskDisable: !!ignoreMaskDisable,
	})

	// convert the flat fields into a selection set
	return fields.toSelectionSet()
}

class FieldCollection {
	config: Config
	fragmentDefinitions: { [name: string]: graphql.FragmentDefinitionNode }
	filepath: string

	fields: { [name: string]: Field<graphql.FieldNode> }
	inlineFragments: { [typeName: string]: Field<graphql.InlineFragmentNode> }
	fragmentSpreads: { [fragmentName: string]: graphql.FragmentSpreadNode }
	ignoreMaskDisable: boolean

	constructor(args: {
		config: Config
		filepath: string
		selections: readonly graphql.SelectionNode[]
		fragmentDefinitions: { [name: string]: graphql.FragmentDefinitionNode }
		ignoreMaskDisable: boolean
	}) {
		this.config = args.config
		this.fragmentDefinitions = args.fragmentDefinitions
		this.ignoreMaskDisable = args.ignoreMaskDisable

		this.fields = {}
		this.inlineFragments = {}
		this.fragmentSpreads = {}

		this.filepath = args.filepath

		for (const selection of args.selections) {
			this.add(selection)
		}
	}

	get size() {
		return (
			Object.keys(this.fields).length +
			Object.keys(this.inlineFragments).length +
			Object.keys(this.fragmentSpreads).length
		)
	}

	add(selection: graphql.SelectionNode) {
		// how we handle the field depends on what kind of field it is
		if (selection.kind === 'Field') {
			// figure out the key of the field
			const key = selection.alias?.value || selection.name.value

			// if we don't already have a field with that name
			if (!this.fields[key]) {
				// create an entry for the selection field
				this.fields[key] = {
					astNode: selection,
					selection: this.empty(),
				}
			}

			// its safe to all this fields selections if they exist
			for (const subselect of selection.selectionSet?.selections || []) {
				this.fields[key].selection.add(subselect)
			}

			// the application of the fragment has been validated already so track it
			// so we can recreate
			this.fields[key].selection.fragmentSpreads = this.collectFragmentSpreads(
				selection.selectionSet?.selections ?? []
			)

			// we're done
			return
		}

		// we could run into an inline fragment that doesn't assert a type (treat it as a field selection)
		if (selection.kind === 'InlineFragment' && !selection.typeCondition) {
			for (const subselect of selection.selectionSet.selections) {
				this.add(subselect)
			}
		}

		// we could run into an inline fragment. the application has been validated already
		// so we just need to add it to the inline fragment for the appropriate type
		if (selection.kind === 'InlineFragment' && selection.typeCondition) {
			// we need to look at the selection set flatten all of the nested
			// inline fragments that could appear. every time we run into a new
			// inline fragment we need to create a new key in the object to add fields to
			this.walkInlineFragment(selection)

			// we're done
			return
		}

		// the only thing that's left is external fragment spreads
		if (selection.kind === 'FragmentSpread') {
			// we need to figure out if we want to include this fragment's selection in
			// the final result.

			// the default behavior depends on wether masking is enabled or disabled
			let includeFragments = this.config.defaultFragmentMasking === 'disable'

			// Check if locally enable
			const maskEnableDirective = selection.directives?.find(
				({ name }) => name.value === this.config.maskEnableDirective
			)
			if (maskEnableDirective) {
				includeFragments = false
			}

			// Check if locally disable
			const maskDisableDirective = selection.directives?.find(
				({ name }) => name.value === this.config.maskDisableDirective
			)
			if (maskDisableDirective) {
				includeFragments = true
			}

			// we might need to ignore any disables
			// for example, queries need to _always_ have their full selection
			// so the result can be written to the cache
			if (this.ignoreMaskDisable) {
				includeFragments = true
			}

			// we're finished if we're not supposed to include fragments in the selection
			if (!includeFragments) {
				return
			}

			// we need to include the fragment selection in the final result
			// look up the definition of the fragment
			const definition = this.fragmentDefinitions[selection.name.value]
			if (!definition) {
				throw new HoudiniError({
					filepath: this.filepath,
					message:
						'Could not find referenced fragment definition: ' + selection.name.value,
				})
			}

			// instead of adding the field on directly, let's turn the external fragment into an inline fragment
			this.add({
				kind: 'InlineFragment',
				typeCondition: {
					kind: 'NamedType',
					name: {
						kind: 'Name',
						value: definition.typeCondition.name.value,
					},
				},
				selectionSet: {
					kind: 'SelectionSet',
					selections: [...definition.selectionSet.selections],
				},
			})
		}
	}

	// collectFragmentSpreads pulls fragment spreads out of deeply nested inline fragments
	collectFragmentSpreads(
		selections: readonly graphql.SelectionNode[],
		result: {
			[fragmentName: string]: graphql.FragmentSpreadNode
		} = {}
	): {
		[fragmentName: string]: graphql.FragmentSpreadNode
	} {
		// loop over the selection set
		for (const selection of selections) {
			// ignore any fields
			if (selection.kind === 'Field') {
				continue
			}

			// inline fragments should get looped over
			if (selection.kind === 'InlineFragment') {
				this.collectFragmentSpreads(selection.selectionSet.selections, result)
				continue
			}

			// and fragment spreads should be added
			if (selection.kind === 'FragmentSpread') {
				result[selection.name.value] = selection
				continue
			}
		}

		// we're done
		return result
	}

	toSelectionSet(): graphql.SelectionNode[] {
		return Object.values(this.inlineFragments)
			.flatMap<graphql.SelectionNode>((fragment) => {
				// if there are no selections in the fragment, skip it
				if (fragment.selection.size === 0) {
					return []
				}

				// convert the selection to a real selection set
				fragment.astNode = {
					...fragment.astNode,
					selectionSet: {
						...fragment.astNode.selectionSet,
						selections: fragment.selection.toSelectionSet(),
					},
				}

				// return the value
				return [fragment.astNode]
			})
			.concat(
				Object.values(this.fields).map((field) => {
					if (field.astNode.selectionSet) {
						field.astNode.selectionSet.selections = field.selection.toSelectionSet()
					}

					return field.astNode
				})
			)
			.concat(Object.values(this.fragmentSpreads))
	}

	walkInlineFragment(selection: graphql.InlineFragmentNode) {
		// figure out the key of the field
		const key = selection.typeCondition!.name.value

		// if we don't already have an inline fragment of that type
		if (!this.inlineFragments[key]) {
			// create an entry for the selection field
			this.inlineFragments[key] = {
				astNode: selection,
				selection: this.empty(),
			}
		}

		// its safe to all this fields selections if they exist
		for (const subselect of selection.selectionSet.selections || []) {
			// the only thing we need to treat specially is inline fragments with type conditions,
			// otherwise just add it like normal to the inline fragment
			if (subselect.kind !== 'InlineFragment' || !subselect.typeCondition) {
				this.inlineFragments[key].selection.add(subselect)
				continue
			}

			// we know the selection is an inline fragment with a type condition so
			// flatten the selection into this one
			this.walkInlineFragment(subselect)
		}
	}

	empty() {
		return new FieldCollection({
			config: this.config,
			fragmentDefinitions: this.fragmentDefinitions,
			selections: [],
			filepath: this.filepath,
			ignoreMaskDisable: this.ignoreMaskDisable,
		})
	}
}

type Field<_AST> = { astNode: _AST; selection: FieldCollection }
