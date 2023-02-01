import type { StatementKind, TSTypeKind } from 'ast-types/lib/gen/kinds'
import * as graphql from 'graphql'
import * as recast from 'recast'

import { type Config, type Document, ArtifactKind, ensureImports } from '../../../lib'
import {
	fs,
	path,
	keyFieldsForType,
	parentTypeFromAncestors,
	TypeWrapper,
	unwrapType,
} from '../../../lib'
import { addReferencedInputTypes } from './addReferencedInputTypes'
import { tsTypeReference } from './typeReference'
import { scalarPropertyValue } from './types'

const AST = recast.types.builders

export default async function imperativeCacheTypef(config: Config, docs: Document[]) {
	// in order to generate type definitions for the write method, we need to
	// make the return value of graphql to the actual data structure that users
	// need to pass. This means figuring out the return type.
	const returnType = (doc: Document) =>
		config.plugins
			.find((plugin) => plugin.graphqlTagReturn)
			?.graphqlTagReturn?.({
				config,
				document: doc,
				ensureImport({ identifier, module }) {
					ensureImports({
						config,
						body,
						sourceModule: module,
						import: [identifier],
					})
				},
			}) ?? 'any'

	// from a specific file
	const target = path.join(config.runtimeDirectory, 'generated.d.ts')

	const body: StatementKind[] = []

	// build up the declaration
	const declaration = AST.tsTypeAliasDeclaration(
		AST.identifier(CacheTypeDefName),
		AST.tsTypeLiteral([
			AST.tsPropertySignature(
				AST.identifier('types'),
				AST.tsTypeAnnotation(typeDefinitions(config, body, docs, returnType))
			),
			AST.tsPropertySignature(
				AST.identifier('lists'),
				AST.tsTypeAnnotation(listDefinitions(config, body, docs))
			),
			AST.tsPropertySignature(
				AST.identifier('queries'),
				AST.tsTypeAnnotation(queryDefinitions(config, body, docs, returnType))
			),
		])
	)
	declaration.declare = true

	// we need to import the record type from the public cache
	const importRecord = AST.importDeclaration(
		[AST.importSpecifier(AST.identifier('Record'))],
		AST.stringLiteral('./public/record')
	)
	importRecord.importKind = 'type'

	// print the result and write to the magic location
	await fs.writeFile(
		target,
		recast.prettyPrint(
			AST.program([importRecord, ...body, AST.exportNamedDeclaration(declaration)])
		).code
	)
}

function typeDefinitions(
	config: Config,
	body: StatementKind[],
	docs: Document[],
	returnType: (doc: Document) => string
): recast.types.namedTypes.TSTypeLiteral {
	// grab a list of the mutation and subscription type names so we don't include them
	const operationTypes = [config.schema.getMutationType(), config.schema.getSubscriptionType()]
		.filter(Boolean)
		.map((type) => type?.name)

	const visitedTypes = new Set<string>()

	// we need to build up a list of all of the concrete types
	const types = Object.values(config.schema.getTypeMap()).filter(
		(type): type is graphql.GraphQLNamedType =>
			!graphql.isAbstractType(type) &&
			!graphql.isScalarType(type) &&
			!graphql.isEnumType(type) &&
			!graphql.isInputObjectType(type) &&
			!type.name.startsWith('__') &&
			!operationTypes.includes(type.name)
	)

	// we need to look for every fragment defined on a concrete type
	const fragmentMap = fragmentListMap(
		config,
		types.map((type) => type.name),
		body,
		docs,
		returnType
	)

	return AST.tsTypeLiteral(
		types.map((type) => {
			// figure out the appropriate type name
			let typeName = type.name
			if (config.schema.getQueryType() && config.schema.getQueryType()?.name === type.name) {
				typeName = '__ROOT__'
			}

			// if the type has a field for every necessary key, it can be looked up
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
			if (graphql.isObjectType(type)) {
				fields = AST.tsTypeLiteral(
					Object.entries(type.getFields()).map(
						([key, fieldType]: [string, graphql.GraphQLField<any, any>]) => {
							// we need to turn ever field into a nested, possible nullable lists

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
								typeOptions.types.push(record(unwrapped.type.name))
							}
							// the type is abtract so add every possible type
							else {
								typeOptions.types.push(
									...config.schema
										.getPossibleTypes(unwrapped.type)
										.map((type) => record(type.name))
								)
							}

							// we need to walk through the list of wrappers and build up the final type object
							for (const wrapper of unwrapped.wrappers) {
								// if the wrapper indicates null is an option, add it
								if (wrapper === TypeWrapper.Nullable) {
									typeOptions = AST.tsParenthesizedType(
										AST.tsUnionType([typeOptions, AST.tsNullKeyword()])
									)
								} else if (wrapper === TypeWrapper.List) {
									typeOptions = AST.tsArrayType(
										AST.tsParenthesizedType(typeOptions)
									)
								}
							}

							// if the last wrapper is a parenthesized type, remove it
							if (typeOptions.type === 'TSParenthesizedType') {
								typeOptions = typeOptions.typeAnnotation
							}

							// if there are no arguments to the field, then we should leave a never behind
							let args: TSTypeKind = AST.tsNeverKeyword()
							if (fieldType.args?.length > 0) {
								args = AST.tsTypeLiteral(
									fieldType.args.map((arg) => {
										// make sure we include any input types used in any args
										addReferencedInputTypes(
											config,
											'',
											body,
											visitedTypes,
											new Set(),
											arg.type
										)

										// add the arg definition for the field
										const prop = AST.tsPropertySignature(
											AST.identifier(arg.name),
											AST.tsTypeAnnotation(
												tsTypeReference(config, new Set(), arg, body)
											)
										)

										const unwrapped = unwrapType(config, arg.type)
										prop.optional =
											unwrapped.wrappers[unwrapped.wrappers.length - 1] ===
											TypeWrapper.Nullable

										return prop
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
						AST.tsPropertySignature(
							AST.identifier('fragments'),
							AST.tsTypeAnnotation(fragmentMap[typeName] ?? AST.tsTupleType([]))
						),
					])
				)
			)
		})
	)
}

function listDefinitions(
	config: Config,
	body: StatementKind[],
	docs: Document[]
): recast.types.namedTypes.TSTypeLiteral | recast.types.namedTypes.TSNeverKeyword {
	// we need to look at every document for a list definition
	const lists: recast.types.namedTypes.TSPropertySignature[] = []

	// we generate @list for every @paginate so we need to deduplicate list names
	const visitedLists = new Set<string>()

	for (const doc of docs) {
		graphql.visit(doc.document, {
			Directive(node, key, parent, path, ancestors) {
				// we only care about fields tagged with the node or paginate directive
				if (![config.listDirective, config.paginateDirective].includes(node.name.value)) {
					return
				}

				// we only care about processing lists with names (and only once)
				const nameArg = node.arguments?.find((arg) => arg.name.value === 'name')
				const nameValue = (nameArg?.value as graphql.StringValueNode)?.value || ''
				if (!nameValue || visitedLists.has(nameValue)) {
					return
				}
				visitedLists.add(nameValue)

				// find the definition of field that it was tagged with

				// look up the parent's type
				const parentType = parentTypeFromAncestors(
					config.schema,
					doc.filename,
					ancestors.slice(0, -1)
				)

				// a non-connection list can just use the selection set of the tagged field
				// but if this is a connection tagged with list we need to use the selection
				// of the edges.node field
				const targetField = ancestors[ancestors.length - 1] as graphql.FieldNode
				const targetFieldDefinition = parentType.getFields()[
					targetField.name.value
				] as graphql.GraphQLField<any, any>

				// get the type of the field
				const { type: listType } = unwrapType(config, targetFieldDefinition.type)
				// we need to build up a union of the possible types that can fall in the list
				const possibleTypes: string[] = []
				if (graphql.isAbstractType(listType)) {
					// get the list of possible types
					possibleTypes.push(
						...config.schema.getPossibleTypes(listType).map((possible) => possible.name)
					)
				} else {
					possibleTypes.push(listType.name)
				}

				// add the list to the list object definition
				lists.push(
					AST.tsPropertySignature(
						AST.identifier(nameValue),
						AST.tsTypeAnnotation(
							AST.tsTypeLiteral([
								AST.tsPropertySignature(
									AST.identifier('types'),
									AST.tsTypeAnnotation(
										AST.tsUnionType(
											possibleTypes.map((possible) =>
												AST.tsLiteralType(AST.stringLiteral(possible))
											)
										)
									)
								),
								AST.tsPropertySignature(
									AST.identifier('filters'),
									AST.tsTypeAnnotation(
										targetFieldDefinition.args.length === 0
											? AST.tsNeverKeyword()
											: AST.tsTypeLiteral(
													targetFieldDefinition.args.map((arg) => {
														const argDef = AST.tsPropertySignature(
															AST.identifier(arg.name),
															AST.tsTypeAnnotation(
																tsTypeReference(
																	config,
																	new Set(),
																	arg,
																	body
																)
															)
														)
														// when args are always optional. just because an argument is required to compute the field
														// does not mean that its required to filter
														argDef.optional = true
														return argDef
													})
											  )
									)
								),
							])
						)
					)
				)
			},
		})
	}
	return AST.tsTypeLiteral(lists)
}

function queryDefinitions(
	config: Config,
	body: StatementKind[],
	docs: Document[],
	returnType: (doc: Document) => string
): recast.types.namedTypes.TSTupleType {
	// we need to build a tuple type that describes the queries
	return AST.tsTupleType(
		docs.reduce<recast.types.namedTypes.TSTupleType[]>((prev, doc) => {
			// if the document is not a query that generates a store, skip it
			if (doc.kind !== ArtifactKind.Query || !doc.generateStore) {
				return prev
			}

			// if the fragment's type condition is not in the concrete list, ignore it
			const definition = doc.document.definitions.find<graphql.OperationDefinitionNode>(
				(def): def is graphql.OperationDefinitionNode =>
					def.kind === 'OperationDefinition' && def.operation === 'query'
			)
			if (!definition) {
				return prev
			}

			// figure out the runtime representation of the doc (the return value of the graphql function)
			const runtimeType = returnType(doc)
			// import the shape type
			const [shapeType, inputType] = ensureImports({
				config,
				body,
				sourceModule: path.relative(
					config.runtimeDirectory,
					config.artifactImportPath(doc.name)
				),
				import: [`${doc.name}$result`, `${doc.name}$input`],
			})

			// we need to add an entry to the tuple for each query document we have (that generates a store)
			// in the order of (tag_value, shape, input)
			return prev.concat(
				AST.tsTupleType([
					AST.tsTypeReference(AST.identifier(runtimeType)),
					AST.tsTypeReference(AST.identifier(shapeType)),
					AST.tsTypeReference(AST.identifier(inputType)),
				])
			)
		}, [])
	)
}

function fragmentListMap(
	config: Config,
	concreteTypes: string[],
	body: StatementKind[],
	docs: Document[],
	return_type: (doc: Document) => string
): { [typeName: string]: recast.types.namedTypes.TSTupleType } {
	// we need to find all of the fragments that are on concrete types,
	// group them by type name and then map them to the fragment list definition
	return docs.reduce<ReturnType<typeof fragmentListMap>>((prev, doc) => {
		// if the doc is not a fragment, ignore it
		if (doc.kind !== ArtifactKind.Fragment) {
			return prev
		}

		// if the fragment's type condition is not in the concrete list, ignore it
		const definition = doc.document.definitions.find<graphql.FragmentDefinitionNode>(
			(def): def is graphql.FragmentDefinitionNode =>
				def.kind === 'FragmentDefinition' && def.name.value === doc.name
		)
		if (!definition || !concreteTypes.includes(definition.typeCondition.name.value)) {
			return prev
		}
		const typeName = definition.typeCondition.name.value

		// if we already had a value at that key, it must be a tuple type
		const previousValue = prev[typeName]?.elementTypes ?? []

		/// compute the fragment information

		// the fragment store wrapper (what's returned from the graphql tag)
		const tagResult = return_type(doc)

		// import the shape type
		const [shapeType] = ensureImports({
			config,
			body,
			sourceModule: path.relative(
				config.runtimeDirectory,
				config.artifactImportPath(doc.name)
			),
			import: [`${definition.name.value}$data`],
		})

		let inputType: TSTypeKind = AST.tsNeverKeyword()
		// if we are looking at fragments, the inputs to the fragment
		// are defined with the arguments directive
		let directive = definition.directives?.find(
			(directive) => directive.name.value === config.argumentsDirective
		)
		if (directive) {
			inputType = AST.tsTypeReference(
				AST.identifier(
					ensureImports({
						config,
						body,
						sourceModule: path.relative(
							config.runtimeDirectory,
							config.artifactImportPath(doc.name)
						),
						import: [`${definition.name.value}$input`],
					})[0]
				)
			)
		}

		return {
			...prev,
			[typeName]: AST.tsTupleType(
				previousValue.concat(
					AST.tsTupleType([
						AST.tsTypeReference(AST.identifier(tagResult)),
						AST.tsTypeReference(AST.identifier(shapeType)),
						inputType,
					])
				)
			),
		}
	}, {})
}

// in order to integrate with the generated runtime
// we need to export a type of the expected name
const CacheTypeDefName = 'CacheTypeDef'

// we're going to wrap the type up in a record
function record(name: string) {
	return AST.tsTypeReference(
		AST.identifier('Record'),
		AST.tsTypeParameterInstantiation([
			AST.tsTypeReference(AST.identifier(CacheTypeDefName)),
			AST.tsLiteralType(AST.stringLiteral(name)),
		])
	)
}

type TypeLiteral = recast.types.namedTypes.TSTypeLiteral | recast.types.namedTypes.TSNeverKeyword
