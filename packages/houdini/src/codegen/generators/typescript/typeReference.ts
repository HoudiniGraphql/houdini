import type { StatementKind, TSTypeKind } from 'ast-types/lib/gen/kinds'
import * as graphql from 'graphql'
import * as recast from 'recast'

import { Config, ensureImports } from '../../../lib'
import { TypeWrapper, unwrapType } from '../../../lib'
import { nullableField, scalarPropertyValue } from './types'

const AST = recast.types.builders

// return the property
export function tsTypeReference(
	config: Config,
	missingScalars: Set<string>,
	definition: {
		type:
			| graphql.GraphQLScalarType
			| graphql.GraphQLInputType
			| graphql.GraphQLNamedType
			| graphql.TypeNode
	},
	body: StatementKind[]
): TSTypeKind {
	const { type, wrappers } = unwrapType(config, definition.type)

	// convert the inner type
	let result
	// if we're looking at a scalar
	if (graphql.isScalarType(type)) {
		result = scalarPropertyValue(config, missingScalars, type)
	}
	//  enums need to be passed to ValueOf
	else if (graphql.isEnumType(type)) {
		// if we looking at an enum we need ValueOf<enum>
		ensureImports({
			config,
			body,
			import: ['ValueOf'],
			importKind: 'type',
			sourceModule: '$houdini/runtime/lib/types',
		})
		result = AST.tsTypeReference(
			AST.identifier('ValueOf'),
			AST.tsTypeParameterInstantiation([AST.tsTypeReference(AST.identifier(type.name))])
		)
	}
	// we're looking at an object
	else {
		// the fields of the object end up as properties in the type literal
		result = AST.tsTypeReference(AST.identifier(type.name))
	}
	for (const toWrap of wrappers) {
		// if its a non-null we don't need to add anything
		if (toWrap === TypeWrapper.NonNull) {
			continue
		} else if (toWrap === TypeWrapper.Nullable) {
			result = nullableField(result, true)
		}
		// it could be a list
		else if (toWrap === TypeWrapper.List) {
			result = AST.tsArrayType(AST.tsParenthesizedType(result))
		}
	}

	return result
}
