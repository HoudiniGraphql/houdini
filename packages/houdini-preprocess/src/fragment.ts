// externals
import * as graphql from 'graphql'
import { CompiledGraphqlFragment } from 'houdini-compiler'
import * as recast from 'recast'
// locals
import { PreProcessorConfig } from '.'
import { selector } from './utils'
const typeBuilders = recast.types.builders

export type TaggedGraphqlFragment = {
	name: string
	kind: 'FragmentDefinition'
	selector: (root: any) => any
}

// returns the expression that should replace the graphql
export default function fragmentReplacement(
	config: PreProcessorConfig,
	document: CompiledGraphqlFragment,
	doc: graphql.DocumentNode
): recast.types.namedTypes.Expression {
	const parsedFragment = doc.definitions[0] as graphql.FragmentDefinitionNode

	// the primary requirement for a fragment is the selector, a function that returns the requested
	// data from the object. we're going to build this up as a function

	// figure out the root type
	const rootType = config.schema.getType(
		parsedFragment.typeCondition.name.value
	) as graphql.GraphQLObjectType
	if (!rootType) {
		throw new Error(
			'Could not find type definition for fragment root' +
				parsedFragment.typeCondition.name.value
		)
	}

	// add the selector to the inlined object
	return typeBuilders.objectExpression([
		typeBuilders.objectProperty(
			typeBuilders.stringLiteral('name'),
			typeBuilders.stringLiteral(document.name)
		),
		typeBuilders.objectProperty(
			typeBuilders.stringLiteral('kind'),
			typeBuilders.stringLiteral(document.kind)
		),
		typeBuilders.objectProperty(
			typeBuilders.stringLiteral('selector'),
			selector({
				config,
				artifact: document,
				rootIdentifier: 'obj',
				rootType,
				selectionSet: parsedFragment.selectionSet,
			})
		),
	])
}
