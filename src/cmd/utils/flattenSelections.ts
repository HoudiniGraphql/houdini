// externals
import * as graphql from 'graphql'
// locals
import { Config } from '../../common'

export function flattenSelections({
	config,
	filepath,
	selections,
	includeFragments,
	fragmentDefinitions,
}: {
	config: Config
	filepath: string
	selections: readonly graphql.SelectionNode[]
	includeFragments: boolean
	fragmentDefinitions: { [name: string]: graphql.FragmentDefinitionNode }
}): readonly graphql.SelectionNode[] {
	// collect all of the fields together
	const fields = new FieldCollection({
		config,
		filepath,
		selections,
		includeFragments,
		fragmentDefinitions,
	})

	// convert the flat fields into a selection set
	return fields.toSelectionSet()
}

class FieldCollection {
	config: Config
	includeFragments: boolean = false
	fragmentDefinitions: { [name: string]: graphql.FragmentDefinitionNode }
	filepath: string

	fields: { [name: string]: Field<graphql.FieldNode> }
	inlineFragments: { [typeName: string]: Field<graphql.InlineFragmentNode> }
	fragmentSpreads: { [fragmentName: string]: graphql.FragmentSpreadNode }

	constructor(args: {
		config: Config
		filepath: string
		selections: readonly graphql.SelectionNode[]
		includeFragments: boolean
		fragmentDefinitions: { [name: string]: graphql.FragmentDefinitionNode }
	}) {
		this.config = args.config
		this.includeFragments = args.includeFragments
		this.fragmentDefinitions = args.fragmentDefinitions

		this.fields = {}
		this.inlineFragments = {}
		this.fragmentSpreads = {}

		this.filepath = args.filepath

		for (const selection of args.selections) {
			this.add(selection)
		}
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
			// figure out the key of the field
			const key = selection.typeCondition.name.value

			// if we don't already have an inline fragment of that type
			if (!this.inlineFragments[key]) {
				// create an entry for the selection field
				this.inlineFragments[key] = {
					astNode: selection,
					selection: this.empty(),
				}
			}

			// its safe to all this fields selections if they exist
			for (const subselect of selection.selectionSet?.selections || []) {
				this.inlineFragments[key].selection.add(subselect)
			}

			// we're done
			return
		}

		// the only thing that's left is external fragment spreads
		if (selection.kind === 'FragmentSpread') {
			// the application of the fragment has been validated already so track it
			// so we can recreate
			this.fragmentSpreads[selection.name.value] = selection

			// we're finished if we're not supposed to include fragments in the selection
			if (!this.includeFragments) {
				return
			}

			const definition = this.fragmentDefinitions[selection.name.value]
			if (!definition) {
				throw {
					filepath: this.filepath,
					message: 'Could not find referenced fragment definition',
				}
			}

			for (const subselect of definition.selectionSet.selections) {
				this.add(subselect)
			}
		}
	}

	toSelectionSet(): graphql.SelectionNode[] {
		return Object.values(this.inlineFragments)
			.map<graphql.SelectionNode>((fragment) => {
				fragment.astNode.selectionSet.selections = fragment.selection.toSelectionSet()

				return fragment.astNode
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

	empty() {
		return new FieldCollection({
			config: this.config,
			includeFragments: this.includeFragments,
			fragmentDefinitions: this.fragmentDefinitions,
			selections: [],
			filepath: this.filepath,
		})
	}
}

type Field<_AST> = { astNode: _AST; selection: FieldCollection }
