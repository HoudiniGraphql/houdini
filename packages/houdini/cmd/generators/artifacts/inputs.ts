// externals
import * as recast from 'recast'
import * as graphql from 'graphql'
import { Config } from 'houdini-common'
import { unwrapType } from '../../utils'

const AST = recast.types.builders

type ObjectProperty = recast.types.namedTypes.ObjectProperty
type ObjectExpression = recast.types.namedTypes.ObjectExpression

export function inputObject(
	config: Config,
	inputs: readonly graphql.VariableDefinitionNode[]
): ObjectExpression {
	// inputs can be recursive so we can't flatten the input type into a single object

	// there will always be an object that maps the root inputs to their type
	const properties: ObjectProperty[] = [
		AST.objectProperty(
			AST.literal('fields'),
			AST.objectExpression(
				inputs.map((input) => {
					// find the inner type
					const { type } = unwrapType(config, input.type)

					// embed the type in the input
					return AST.objectProperty(
						AST.literal(input.variable.name.value),
						AST.stringLiteral(type.name)
					)
				})
			)
		),
	]

	// make sure we don't define the same input type
	const visitedTypes = new Set<string>()

	const typeObjectProperties: ObjectProperty[] = []
	for (const input of inputs) {
		walkInputs(config, visitedTypes, typeObjectProperties, input.type)
	}
	properties.push(
		AST.objectProperty(AST.literal('types'), AST.objectExpression(typeObjectProperties))
	)

	return AST.objectExpression(properties)
}

function walkInputs(
	config: Config,
	visitedTypes: Set<string>,
	properties: ObjectProperty[],
	rootType: graphql.TypeNode | graphql.GraphQLNamedType
) {
	// find the core type
	const { type } = unwrapType(config, rootType)

	// if we've seen this type already
	if (visitedTypes.has(type.name)) {
		// don't do anything else
		return
	}

	// if this is a scalar or enum then we don't need to add anything to the type object
	if (graphql.isEnumType(type) || graphql.isScalarType(type)) {
		return
	}
	if (graphql.isUnionType(type)) {
		return
	}

	// we haven't seen this type before and are about to generate the type
	visitedTypes.add(type.name)

	// generate the entry for the type
	properties.push(
		AST.objectProperty(
			AST.literal(type.name),
			AST.objectExpression(
				Object.values(type.getFields()).map((field: graphql.GraphQLInputField) => {
					const { type: fieldType } = unwrapType(config, field.type)

					// keep walking down
					walkInputs(config, visitedTypes, properties, fieldType)

					return AST.objectProperty(
						AST.literal(field.name),
						AST.stringLiteral(fieldType.toString())
					)
				})
			)
		)
	)
}
