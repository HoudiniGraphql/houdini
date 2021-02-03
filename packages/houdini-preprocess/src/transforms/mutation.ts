// externals
import * as graphql from 'graphql'
import { CompiledGraphqlOperation } from 'houdini-compiler'
import * as recast from 'recast'
// locals
import { PreProcessorConfig } from '../types'
import { selector } from '../utils'
const typeBuilders = recast.types.builders

export default function mutationProperties(
	config: PreProcessorConfig,
	operation: CompiledGraphqlOperation,
	doc: graphql.OperationDefinitionNode
): recast.types.namedTypes.Expression {
	// figure out the root type
	const rootType = config.schema.getMutationType()
	if (!rootType) {
		throw new Error('Could not find operation type')
	}

	// pass the raw query string for the network request
	return typeBuilders.objectExpression([
		typeBuilders.objectProperty(
			typeBuilders.stringLiteral('name'),
			typeBuilders.stringLiteral(operation.name)
		),
		typeBuilders.objectProperty(
			typeBuilders.stringLiteral('kind'),
			typeBuilders.stringLiteral(operation.kind)
		),
		typeBuilders.objectProperty(
			typeBuilders.stringLiteral('raw'),
			typeBuilders.stringLiteral(operation.raw)
		),
		typeBuilders.objectProperty(
			typeBuilders.stringLiteral('processResult'),
			selector({
				config,
				artifact: operation,
				rootIdentifier: 'data',
				rootType,
				selectionSet: doc.selectionSet,
				// grab values from the immediate response
				pullValuesFromRef: false,
			})
		),
	])
}
