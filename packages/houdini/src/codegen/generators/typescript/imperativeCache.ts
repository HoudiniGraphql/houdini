import { TSTypeKind } from 'ast-types/gen/kinds'
import * as graphql from 'graphql'
import * as recast from 'recast'

import { Config, CollectedGraphQLDocument, fs, path, keyFieldsForType } from '../../../lib'
import { TypeWrapper, unwrapType } from '../../utils'
import { tsTypeReference } from './typeReference'
import { scalarPropertyValue } from './types'

const AST = recast.types.builders

export default async function imperativeCacheTypef(
	config: Config,
	docs: CollectedGraphQLDocument[]
) {
	// in order to integrate with the generated runtime
	// we need to export a type of the expected name
	const CacheTypeDefName = 'CacheTypeDef'
	// from a specific file
	const target = path.join(config.runtimeDirectory, 'generated.d.ts')

	// we need to import every enum
	const enums = Object.values(config.schema.getTypeMap()).filter(
		(type) =>
			graphql.isEnumType(type) &&
			!config.isInternalEnum({
				kind: 'EnumTypeDefinition',
				name: {
					kind: 'Name',
					value: type.name,
				},
			}) &&
			!type.name.startsWith('__')
	)

	const enumImport = AST.importDeclaration(
		enums.map((enumType) => AST.importSpecifier(AST.identifier(enumType.name))),
		AST.stringLiteral(path.relative(config.runtimeDirectory, config.definitionsDirectory))
	)

	// build up the declaration
	const declaration = AST.tsTypeAliasDeclaration(
		AST.identifier(CacheTypeDefName),
		AST.tsTypeLiteral([
			AST.tsPropertySignature(
				AST.identifier('types'),
				AST.tsTypeAnnotation(typeDefinitions(config))
			),
			AST.tsPropertySignature(
				AST.identifier('lists'),
				AST.tsTypeAnnotation(listDefinitions(config, docs))
			),
		])
	)
	declaration.declare = true

	// print the result and write to the magic location
	await fs.writeFile(
		target,
		recast.prettyPrint(AST.program([enumImport, AST.exportNamedDeclaration(declaration)])).code
	)
}

function typeDefinitions(config: Config): recast.types.namedTypes.TSTypeLiteral {
	// grab a list of the mutation and subscription type names so we don't include them
	const operationTypes = [config.schema.getMutationType(), config.schema.getSubscriptionType()]
		.filter(Boolean)
		.map((type) => type?.name)

	// we need to build up a list of all of the types
	const types = Object.values(config.schema.getTypeMap()).filter(
		(type): type is graphql.GraphQLNamedType =>
			!graphql.isAbstractType(type) &&
			!graphql.isScalarType(type) &&
			!graphql.isEnumType(type) &&
			!type.name.startsWith('__') &&
			!operationTypes.includes(type.name)
	)

	return AST.tsTypeLiteral(
		types.map((type) => {
			// figure out the appropriate type name
			let typeName = type.name
			if (config.schema.getQueryType() && config.schema.getQueryType()?.name === type.name) {
				typeName = '__ROOT__'
			}

			// if the type has a field for every necesary key, it can be looked up
			let idFields: TypeLiteral = AST.tsNeverKeyword()
			const keys = keyFieldsForType(config.configFile, type.name)
			if (
				graphql.isObjectType(type) &&
				keys.length > 0 &&
				keys.every((key) => type.getFields()[key])
			) {
				idFields = AST.tsTypeLiteral(
					keys.map((key) => {
						const fieldType = type.getFields()[key]
						// figure out what was wrapped up
						const unwrapped = unwrapType(config, fieldType.type)

						return AST.tsPropertySignature(
							AST.identifier(key),
							AST.tsTypeAnnotation(
								scalarPropertyValue(config, new Set<string>(), unwrapped.type)
							)
						)
					})
				)
			}
			// the root object can take an empty object
			else if (typeName === '__ROOT__') {
				idFields = AST.tsTypeLiteral([])
			}

			// build up the field objects
			let fields: TypeLiteral = AST.tsTypeLiteral([])
			if (graphql.isObjectType(type) || graphql.isInputObjectType(type)) {
				fields = AST.tsTypeLiteral(
					Object.entries(type.getFields()).map(
						([key, fieldType]: [string, graphql.GraphQLField<any, any>]) => {
							// figure out what was wrapped up
							const unwrapped = unwrapType(config, fieldType.type)

							// build up all of the options as a union of at least 1
							let typeOptions: TSTypeKind = AST.tsUnionType([])
							if (graphql.isScalarType(unwrapped.type)) {
								typeOptions.types.push(
									scalarPropertyValue(config, new Set<string>(), unwrapped.type)
								)
							}
							// enums are valid to use directly
							else if (graphql.isEnumType(unwrapped.type)) {
								typeOptions.types.push(
									AST.tsTypeReference(AST.identifier(unwrapped.type.name))
								)
							}
							// if the type isn't abtract, we just need to leave behind a string
							else if (!graphql.isAbstractType(unwrapped.type)) {
								typeOptions.types.push(
									AST.tsLiteralType(AST.stringLiteral(unwrapped.type.name))
								)
							}
							// the type is abtract so add every possible type
							else {
								typeOptions.types.push(
									...config.schema
										.getPossibleTypes(unwrapped.type)
										.map((type) =>
											AST.tsLiteralType(AST.stringLiteral(type.name))
										)
								)
							}

							// if the first entry is a NonNull indicator, we need to add null to the list
							const head = unwrapped.wrappers.pop()
							if (head === TypeWrapper.Nullable) {
								typeOptions.types.push(AST.tsNullKeyword())
							}

							// if there is a list in here
							if (
								head === TypeWrapper.List ||
								unwrapped.wrappers.includes(TypeWrapper.List)
							) {
								typeOptions = AST.tsTypeLiteral([
									AST.tsPropertySignature(
										AST.identifier('list'),
										AST.tsTypeAnnotation(typeOptions)
									),

									AST.tsPropertySignature(
										AST.identifier('nullable'),
										AST.tsTypeAnnotation(
											AST.tsLiteralType(
												AST.booleanLiteral(
													unwrapped.wrappers.includes(TypeWrapper.NonNull)
												)
											)
										)
									),
								])
							} else if (
								!graphql.isScalarType(unwrapped.type) &&
								!graphql.isEnumType(unwrapped.type)
							) {
								typeOptions = AST.tsTypeLiteral([
									AST.tsPropertySignature(
										AST.identifier('record'),
										AST.tsTypeAnnotation(typeOptions)
									),
								])
							}

							// if there are no arguments to the field, then we should leave a never behind
							let args: TSTypeKind = AST.tsNeverKeyword()
							if (fieldType.args?.length > 0) {
								args = AST.tsTypeLiteral(
									fieldType.args.map((arg) => {
										return AST.tsPropertySignature(
											AST.identifier(arg.name),
											AST.tsTypeAnnotation(
												tsTypeReference(config, new Set(), arg)
											)
										)
									})
								)
							}

							return AST.tsPropertySignature(
								AST.identifier(key),
								AST.tsTypeAnnotation(
									AST.tsTypeLiteral([
										AST.tsPropertySignature(
											AST.identifier('type'),
											AST.tsTypeAnnotation(typeOptions)
										),
										AST.tsPropertySignature(
											AST.identifier('args'),
											AST.tsTypeAnnotation(args)
										),
									])
								)
							)
						}
					)
				)
			}

			return AST.tsPropertySignature(
				AST.identifier(typeName),
				AST.tsTypeAnnotation(
					AST.tsTypeLiteral([
						AST.tsPropertySignature(
							AST.identifier('idFields'),
							AST.tsTypeAnnotation(idFields)
						),
						AST.tsPropertySignature(
							AST.identifier('fields'),
							AST.tsTypeAnnotation(fields)
						),
					])
				)
			)
		})
	)
}

function listDefinitions(
	config: Config,
	docs: CollectedGraphQLDocument[]
): recast.types.namedTypes.TSTypeLiteral {
	return AST.tsTypeLiteral([])
}

type TypeLiteral = recast.types.namedTypes.TSTypeLiteral | recast.types.namedTypes.TSNeverKeyword
