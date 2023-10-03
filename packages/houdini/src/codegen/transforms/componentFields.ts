import * as graphql from 'graphql'

import type { Config, Document } from '../../lib'

export type FragmentDependency = {
	definition: graphql.FragmentDefinitionNode
	requiredFragments: string[]
	document: Document
}

// componentFields replaces component fields with the appropriate fragment
export default async function componentFields(
	config: Config,
	documents: Document[]
): Promise<void> {
	for (const document of documents) {
		const typeInfo = new graphql.TypeInfo(config.schema)

		document.document = graphql.visit(
			document.document,
			graphql.visitWithTypeInfo(typeInfo, {
				Field(node) {
					// if the user refers to a field that's actually a component field
					// we need to include the associated fragment
					const parentType = typeInfo.getParentType()
					if (!parentType) {
						return
					}

					// if the field is a component field then we need to replace it with the appropriate
					// fragment
					const fieldName = node.name.value
					const { fragment, directive } =
						config.componentFields[parentType.name]?.[fieldName] ?? {}
					if (!fragment) {
						return
					}

					// the list of directives we want applied should be the same as the
					// source list with the component field directive
					const directives: graphql.DirectiveNode[] = [...(node.directives ?? [])]
					directives.push(directive)

					// if there are arguments on the field then we need to translate them to
					// arguments on the fragment spread
					const args: graphql.ArgumentNode[] = []
					for (const arg of node.arguments ?? []) {
						args.push({
							kind: 'Argument',
							name: {
								kind: 'Name',
								value: arg.name.value,
							},
							value: arg.value,
						})
					}
					if (args.length > 0) {
						directives.push({
							kind: 'Directive',
							name: {
								kind: 'Name',
								value: config.withDirective,
							},
							arguments: args,
						})
					}

					// replace the field with a fragment spread
					return {
						kind: 'FragmentSpread',
						name: {
							kind: 'Name',
							value: fragment,
						},
						directives,
					} as graphql.FragmentSpreadNode
				},
			})
		)
	}
}
