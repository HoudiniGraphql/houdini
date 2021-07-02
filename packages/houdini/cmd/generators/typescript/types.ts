// externals
import * as recast from 'recast'
import * as graphql from 'graphql'
import { TSTypeKind } from 'ast-types/gen/kinds'

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

export function scalarPropertyValue(target: graphql.GraphQLNamedType): TSTypeKind {
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
			if (graphql.isNonNullType(target)) {
				return scalarPropertyValue(target.ofType)
			}

			throw new Error('Could not convert scalar type: ' + target.toString())
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
