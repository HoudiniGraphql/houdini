import type { StatementKind, TSTypeKind } from 'ast-types/lib/gen/kinds'
import * as graphql from 'graphql'
import * as recast from 'recast'

import { ensureImports, type Config, path } from '../../../lib'

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
	target: graphql.GraphQLNamedType,
	body: StatementKind[],
	field: { parent: string; field: string } | null
): TSTypeKind {
	// before we get to the generic behavior, let's process components when we want to
	if (config.configFile.features?.componentFields && target.name === config.componentScalar) {
		// if we are importing a component we need to make sure we have a reference to
		// component
		if (!field) {
			return AST.tsNeverKeyword()
		}

		// look up the component field information
		const component = config.componentFields[field.parent][field.field]
		const sourcePathRelative = path.relative(
			path.join(config.projectRoot, 'src'),
			component.filepath
		)

		let sourcePathParsed = path.parse(sourcePathRelative)
		let sourcePath = path.join(sourcePathParsed.dir, sourcePathParsed.name)

		// add the import
		const localImport = ensureImports({
			config,
			body,
			import: '__component__' + component.fragment,
			sourceModule: '~/' + sourcePath,
		})

		// build up the AST for the parameter type
		const parameters = AST.tsTypeReference(AST.identifier('Parameters'))
		parameters.typeParameters = AST.tsTypeParameterInstantiation([
			AST.tsTypeQuery(AST.identifier(localImport)),
		])
		const indexed = AST.tsIndexedAccessType(
			parameters,
			AST.tsLiteralType(AST.numericLiteral(0))
		)
		const omit = AST.tsTypeReference(AST.identifier('Omit'))
		omit.typeParameters = AST.tsTypeParameterInstantiation([
			indexed,
			AST.tsLiteralType(AST.stringLiteral(component.prop)),
		])
		const arg = AST.identifier('props')
		arg.typeAnnotation = AST.tsTypeAnnotation(omit)

		// build up the AST for the return type
		const returnType = AST.tsTypeReference(AST.identifier('ReturnType'))
		returnType.typeParameters = AST.tsTypeParameterInstantiation([
			AST.tsTypeQuery(AST.identifier(localImport)),
		])

		const fnType = AST.tsFunctionType([arg])
		fnType.typeAnnotation = AST.tsTypeAnnotation(returnType)

		return fnType
	}

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
					target.ofType as graphql.GraphQLNamedType,
					body,
					field
				)
			}

			// the type could be a custom scalar we know about
			if (config.scalars?.[target.name]) {
				return AST.tsTypeReference(AST.identifier(config.scalars?.[target.name].type))
			}

			// don't ever consider the Component scalar missing
			if (target.name !== config.componentScalar) {
				missingScalars.add(target.name)
			}

			return AST.tsAnyKeyword()
		}
	}
}
