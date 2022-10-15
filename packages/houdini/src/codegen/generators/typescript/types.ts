import type { TSTypeKind } from 'ast-types/gen/kinds'
import * as graphql from 'graphql'
import * as recast from 'recast'

import { Config } from '../../../lib'

const AST = recast.types.builders

export function readonlyProperty(
	prop: recast.types.namedTypes.TSPropertySignature,
	enable: boolean = true
): recast.types.namedTypes.TSPropertySignature {
	if (enable) {
		prop.readonly = true
	}
	return prop
}

export function nullableField(inner: TSTypeKind, input = false) {
	// the members of the union
	const members = [inner, AST.tsNullKeyword()]
	if (input) {
		members.push(AST.tsUndefinedKeyword())
	}

	return AST.tsUnionType(members)
}

export function scalarPropertyValue(
	config: Config,
	missingScalars: Set<string>,
	target: graphql.GraphQLNamedType
): TSTypeKind {
	switch (target.name) {
		case 'String': {
			return AST.tsStringKeyword()
		}
		case 'Int': {
			return AST.tsNumberKeyword()
		}
		case 'Float': {
			return AST.tsNumberKeyword()
		}
		case 'Boolean': {
			return AST.tsBooleanKeyword()
		}
		case 'ID': {
			return AST.tsStringKeyword()
		}
		default: {
			// if we're looking at a non-null type
			if (graphql.isNonNullType(target) && 'ofType' in target) {
				return scalarPropertyValue(
					config,
					missingScalars,
					target.ofType as graphql.GraphQLNamedType
				)
			}

			// the type could be a custom scalar we know about
			if (config.scalars?.[target.name]) {
				return AST.tsTypeReference(AST.identifier(config.scalars?.[target.name].type))
			}

			missingScalars.add(target.name)

			return AST.tsAnyKeyword()
		}
	}
}

export function enumDeclaration(type: graphql.GraphQLEnumType) {
	return AST.tsEnumDeclaration(
		AST.identifier(type.name),
		type
			.getValues()
			.map((value) =>
				AST.tsEnumMember(AST.identifier(value.name), AST.stringLiteral(value.name))
			)
	)
}
