import * as graphql from 'graphql'
import * as recast from 'recast'

import { Config } from '../../../lib/config'
import { InputObject } from '../../../runtime/lib/types'
import { unwrapType } from '../../utils'

const AST = recast.types.builders

export function inputObject(
	config: Config,
	inputs: readonly graphql.VariableDefinitionNode[]
): InputObject {
	// make sure we don't define the same input type
	const visitedTypes = new Set<string>()

	// inputs can be recursive so we can't flatten the input type into a single object
	const inputObj: InputObject = {
		fields: inputs.reduce((fields, input) => {
			// find the inner type
			const { type } = unwrapType(config, input.type)

			// embed the type in the input
			return {
				...fields,
				[input.variable.name.value]: type.name,
			}
		}, {}),
		types: {},
	}

	// walk through every type referenced and add it to the list
	for (const input of inputs) {
		walkInputs(config, visitedTypes, inputObj, input.type)
	}

	return inputObj
}

function walkInputs(
	config: Config,
	visitedTypes: Set<string>,
	inputObj: InputObject,
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
	inputObj!.types[type.name] = Object.values(type.getFields()).reduce(
		(typeFields, field: graphql.GraphQLInputField) => {
			const { type: fieldType } = unwrapType(config, field.type)

			// keep walking down
			walkInputs(config, visitedTypes, inputObj, fieldType)

			return {
				...typeFields,
				[field.name]: fieldType.toString(),
			}
		},
		{}
	)
}
