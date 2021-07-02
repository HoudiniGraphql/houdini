// externals
import { Config } from 'houdini-common'
import * as recast from 'recast'
import * as graphql from 'graphql'
import { TSTypeKind } from 'ast-types/gen/kinds'
// locals
import { unwrapType } from '../../utils'
import { nullableField, scalarPropertyValue } from './types'

const AST = recast.types.builders

// return the property
export function tsTypeReference(
	config: Config,
	definition: { type: graphql.TypeNode }
): TSTypeKind {
	const { type, nullable, nonNull, list } = unwrapType(config, definition.type)

	// convert the inner type
	let result
	// if we're looking at a scalar
	if (graphql.isScalarType(type)) {
		result = scalarPropertyValue(type)
	}
	// we're looking at an object
	else {
		// the fields of the object end up as properties in the type literal
		result = AST.tsTypeReference(AST.identifier(type.name))
	}

	// if we are wrapping a list
	if (list) {
		// if we do not have an inner non-null, wrap it
		if (!nonNull) {
			result = nullableField(result, true)
		}
		// wrap it in the list
		result = AST.tsArrayType(AST.tsParenthesizedType(result))

		// if we do not have an outer null
		if (!nullable) {
			result = nullableField(result, true)
		}
	} else {
		// if we aren't marked as non-null
		if (!nonNull && !nullable) {
			result = nullableField(result, true)
		}
	}

	return result
}
