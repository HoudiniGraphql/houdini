import * as graphql from 'graphql'
import * as recast from 'recast'

import { unwrapType } from '../../../lib'
import type { Config } from '../../../lib/config'
import type { InputObject } from '../../../runtime/lib/types'

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
		defaults: inputs.reduce((fields, input) => {
			return {
				...fields,
				[input.variable.name.value]: parseInputField(input.defaultValue),
			}
		}, {}),
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

function parseInputField(field: graphql.ValueNode | undefined): any {
	if (!field) {
		return undefined
	}

	if (
		field.kind === 'BooleanValue' ||
		field.kind === 'EnumValue' ||
		field.kind === 'StringValue'
	) {
		return field.value
	} else if (field.kind === 'IntValue') {
		// ints and floats are stored as `string` in graphql-js, so we need to manually parse them
		return parseInt(field.value)
	} else if (field.kind === 'FloatValue') {
		return parseFloat(field.value)
	} else if (field.kind === 'ListValue') {
		return field.values.map((f) => parseInputField(f))
	} else if (field.kind === 'ObjectValue') {
		return field.fields.reduce((fields, input) => {
			return {
				...fields,
				[input.name.value]: parseInputField(input.value),
			}
		}, {})
	}

	return undefined
}
