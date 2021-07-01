// externals
import { Config, selectionTypeInfo, isScalarType, isObjectType, isListType } from 'houdini-common'
import * as recast from 'recast'
import fs from 'fs/promises'
import * as graphql from 'graphql'
import { TSTypeKind, StatementKind, TSPropertySignatureKind } from 'ast-types/gen/kinds'
import path from 'path'
// locals
import { CollectedGraphQLDocument } from '../types'
import { writeFile, unwrapType } from '../utils'

const AST = recast.types.builders

const fragmentKey = '$fragments'

// typescriptGenerator generates typescript definitions for the artifacts
export default async function typescriptGenerator(
	config: Config,
	docs: CollectedGraphQLDocument[]
) {
	// build up a list of paths we have types in (to export from index.d.ts)
	const typePaths: string[] = []

	// every document needs a generated type
	await Promise.all(
		// the generated types depend solely on user-provided information
		// so we need to use the original document that we haven't mutated
		// as part of the compiler
		docs.map(async ({ originalDocument, name, printed }) => {
			// the place to put the artifact's type definition
			const typeDefPath = config.artifactTypePath(originalDocument)

			// build up the program
			const program = AST.program([])

			// if we have to define any types along the way, make sure we only do it once
			const visitedTypes = new Set<string>()

			// if there's an operation definition
			if (originalDocument.definitions.find((def) => def.kind === 'OperationDefinition')) {
				// treat it as an operation document
				await generateOperationTypeDefs(
					config,
					program.body,
					originalDocument.definitions,
					visitedTypes
				)
			} else {
				// treat it as a fragment document
				await generateFragmentTypeDefs(
					config,
					program.body,
					originalDocument.definitions,
					visitedTypes
				)
			}

			// write the file contents
			await writeFile(typeDefPath, recast.print(program).code)

			typePaths.push(typeDefPath)
		})
	)

	// now that we have every type generated, create an index file in the runtime root that exports the types
	const typeIndex = AST.program(
		typePaths
			.map((typePath) => {
				return AST.exportAllDeclaration(
					AST.literal(
						'./' +
							path
								.relative(path.resolve(config.typeIndexPath, '..'), typePath)
								// remove the .d.ts from the end of the path
								.replace(/\.[^/.]+\.[^/.]+$/, '')
					),
					null
				)
			})
			.concat([AST.exportAllDeclaration(AST.literal('./runtime'), null)])
	)

	// write the contents
	await writeFile(config.typeIndexPath, recast.print(typeIndex).code)
}

async function generateOperationTypeDefs(
	config: Config,
	body: StatementKind[],
	definitions: readonly graphql.DefinitionNode[],
	visitedTypes: Set<string>
) {
	// handle any fragment definitions
	await generateFragmentTypeDefs(
		config,
		body,
		definitions.filter(({ kind }) => kind === 'FragmentDefinition'),
		visitedTypes
	)

	// every definition will contribute something to the typedef
	for (const definition of definitions) {
		if (definition.kind !== 'OperationDefinition' || !definition.name) {
			continue
		}

		// the name of the types we will define
		const inputTypeName = `${definition.name.value}$input`
		const shapeTypeName = `${definition.name.value}$result`

		// look up the root type of the document
		let type: graphql.GraphQLNamedType | null | undefined
		if (definition.operation === 'query') {
			type = config.schema.getQueryType()
		} else if (definition.operation === 'mutation') {
			type = config.schema.getMutationType()
		} else if (definition.operation === 'subscription') {
			type = config.schema.getSubscriptionType()
		}
		if (!type) {
			throw new Error('Could not find root type for document')
		}

		// dry
		const hasInputs =
			definition.variableDefinitions && definition.variableDefinitions.length > 0

		// add our types to the body
		body.push(
			// add the root type named after the document that links the input and result types
			AST.exportNamedDeclaration(
				AST.tsTypeAliasDeclaration(
					AST.identifier(definition.name.value),
					AST.tsTypeLiteral([
						readonlyProperty(
							AST.tsPropertySignature(
								AST.stringLiteral('input'),
								AST.tsTypeAnnotation(
									hasInputs
										? AST.tsTypeReference(AST.identifier(inputTypeName))
										: AST.tsNullKeyword()
								)
							)
						),
						readonlyProperty(
							AST.tsPropertySignature(
								AST.stringLiteral('result'),
								AST.tsTypeAnnotation(
									AST.tsTypeReference(AST.identifier(shapeTypeName))
								)
							)
						),
					])
				)
			),

			// export the type that describes the result
			AST.exportNamedDeclaration(
				AST.tsTypeAliasDeclaration(
					AST.identifier(shapeTypeName),
					tsType({
						config,
						rootType: type,
						selections: [...definition.selectionSet.selections],
						root: true,
						allowReadonly: true,
						visitedTypes,
						body,
					})
				)
			)
		)

		// if there are variables in this query
		if (
			hasInputs &&
			definition.variableDefinitions &&
			definition.variableDefinitions.length > 0
		) {
			for (const variableDefinition of definition.variableDefinitions) {
				addReferencedInputTypes(config, body, visitedTypes, variableDefinition.type)
			}

			// merge all of the variables into a single object
			body.push(
				AST.exportNamedDeclaration(
					AST.tsTypeAliasDeclaration(
						AST.identifier(inputTypeName),
						AST.tsTypeLiteral(
							(definition.variableDefinitions || []).map(
								(definition: graphql.VariableDefinitionNode) =>
									// add a property describing the variable to the root object
									AST.tsPropertySignature(
										AST.identifier(definition.variable.name.value),
										AST.tsTypeAnnotation(tsTypeReference(config, definition))
									)
							)
						)
					)
				)
			)
		}
	}
}

// add any object types found in the input
function addReferencedInputTypes(
	config: Config,
	body: StatementKind[],
	visitedTypes: Set<string>,
	rootType: graphql.TypeNode
) {
	// try to find the name of the type
	const { type } = unwrapType(config, rootType)

	// if we are looking at a scalar
	if (graphql.isScalarType(type)) {
		// we're done
		return
	}

	// if we have already processed this type, dont do anything
	if (visitedTypes.has(type.name)) {
		return
	}

	// if we ran into a union
	if (graphql.isUnionType(type)) {
		// we don't support them yet
		throw new Error('Unions are not supported yet. Sorry!')
	}

	// track that we are processing the type
	visitedTypes.add(type.name)

	// if we ran into an enum, add its definition to the file
	if (graphql.isEnumType(type)) {
		body.push(
			AST.tsEnumDeclaration(
				AST.identifier(type.name),
				type
					.getValues()
					.map((value) =>
						AST.tsEnumMember(AST.identifier(value.name), AST.stringLiteral(value.name))
					)
			)
		)
		return
	}

	// we found an object type so build up the list of fields (and walk down any object fields)
	const members: TSPropertySignatureKind[] = []

	for (const field of Object.values(type.getFields())) {
		// walk down the referenced fields and build stuff back up
		addReferencedInputTypes(config, body, visitedTypes, field.type)

		members.push(
			AST.tsPropertySignature(
				AST.identifier(field.name),
				AST.tsTypeAnnotation(tsTypeReference(config, field))
			)
		)
	}

	// add the type def to the body
	body.push(AST.tsTypeAliasDeclaration(AST.identifier(type.name), AST.tsTypeLiteral(members)))
}

// return the property
const tsTypeReference = (config: Config, definition: { type: graphql.TypeNode }): TSTypeKind => {
	const { type, nullable: nonNull, nonNull: innerNonNull, list } = unwrapType(
		config,
		definition.type
	)

	const namedTypeNode = type as graphql.NamedTypeNode | graphql.GraphQLScalarType

	// now that we have the name of the input type, lets look it up in the schema
	const definitionTypeName =
		typeof namedTypeNode.name === 'string' ? namedTypeNode.name : namedTypeNode.name.value
	const definitionType = config.schema.getType(
		definitionTypeName
	) as graphql.GraphQLInputObjectType
	if (!definitionType) {
		throw new Error('Could not find definition of type')
	}

	// convert the inner type
	let result
	// if we're looking at a scalar
	if (graphql.isScalarType(definitionType)) {
		result = scalarPropertyValue(definitionType)
	}
	// we're looking at an object
	else {
		// the fields of the object end up as properties in the type literal
		result = AST.tsTypeReference(AST.identifier(definitionType.name))
	}

	// if we are wrapping a list
	if (list) {
		// if we do not have an inner non-null, wrap it
		if (!innerNonNull) {
			result = nullable(result, true)
		}
		// wrap it in the list
		result = AST.tsArrayType(AST.tsParenthesizedType(result))

		// if we do not have an outer null
		if (!nonNull) {
			result = nullable(result, true)
		}
	} else {
		// if we aren't marked as non-null
		if (!innerNonNull && !nonNull) {
			result = nullable(result, true)
		}
	}

	return result
}

async function generateFragmentTypeDefs(
	config: Config,
	body: StatementKind[],
	definitions: readonly graphql.DefinitionNode[],
	visitedTypes: Set<string>
) {
	// every definition will contribute the same thing to the typedefs
	for (const definition of definitions) {
		// if its not a fragment definition
		if (definition.kind !== 'FragmentDefinition') {
			// we don't know what to do
			continue
		}

		// the name of the prop type
		const propTypeName = definition.name.value
		// the name of the shape type
		const shapeTypeName = `${definition.name.value}$data`

		// look up the root type of the document
		const type = config.schema.getType(definition.typeCondition.name.value)
		if (!type) {
			throw new Error('Should not get here')
		}

		body.push(
			// we need to add a type that will act as the entry point for the fragment
			// and be assigned to the prop that holds the reference passed from
			// the fragment's parent
			AST.exportNamedDeclaration(
				AST.tsTypeAliasDeclaration(
					AST.identifier(propTypeName),
					AST.tsTypeLiteral([
						readonlyProperty(
							AST.tsPropertySignature(
								AST.stringLiteral('shape'),
								AST.tsTypeAnnotation(
									AST.tsTypeReference(AST.identifier(shapeTypeName))
								),
								true
							)
						),
						readonlyProperty(
							AST.tsPropertySignature(
								AST.stringLiteral(fragmentKey),
								AST.tsTypeAnnotation(
									AST.tsTypeLiteral([
										AST.tsPropertySignature(
											AST.stringLiteral(propTypeName),
											AST.tsTypeAnnotation(
												AST.tsLiteralType(AST.booleanLiteral(true))
											)
										),
									])
								)
							)
						),
					])
				)
			),

			// export the type that describes the fragments response data
			AST.exportNamedDeclaration(
				AST.tsTypeAliasDeclaration(
					AST.identifier(shapeTypeName),
					tsType({
						config,
						rootType: type,
						selections: [...definition.selectionSet.selections],
						root: true,
						allowReadonly: true,
						body,
						visitedTypes,
					})
				)
			)
		)
	}
}

function tsType({
	config,
	rootType,
	selections,
	root,
	allowReadonly,
	body,
	visitedTypes,
}: {
	config: Config
	rootType: graphql.GraphQLNamedType
	selections: graphql.SelectionNode[] | undefined
	root: boolean
	allowReadonly: boolean
	body: StatementKind[]
	visitedTypes: Set<string>
}): TSTypeKind {
	// start unwrapping non-nulls and lists (we'll wrap it back up before we return)
	const { type, list, nullable: nonNull, nonNull: innerNonNull } = unwrapType(config, rootType)

	let result: TSTypeKind
	// if we are looking at a scalar field
	if (isScalarType(type)) {
		result = scalarPropertyValue(type as graphql.GraphQLNamedType)
	}
	// we could have encountered an enum
	else if (graphql.isEnumType(type)) {
		// have we seen the enum before
		if (!visitedTypes.has(type.name)) {
		}

		result = AST.tsTypeReference(AST.identifier(type.name))
	}
	// if we are looking at an object
	else if (isObjectType(type)) {
		const rootObj = type as graphql.GraphQLObjectType<any, any>

		result = AST.tsTypeLiteral([
			// every field gets an entry in the object
			...((selections || []).filter(
				(field) => field.kind === 'Field'
			) as graphql.FieldNode[]).map((selection) => {
				// grab the type info for the selection
				const { type, field } = selectionTypeInfo(config.schema, rootObj, selection)

				// figure out the response name
				const attributeName = selection.alias?.value || selection.name.value

				// figure out the corresponding typescript type
				let attributeType = tsType({
					config,
					rootType: field.type as graphql.GraphQLNamedType,
					selections: selection.selectionSet?.selections as graphql.SelectionNode[],
					root: false,
					allowReadonly,
					visitedTypes,
					body,
				})

				// we're done
				return readonlyProperty(
					AST.tsPropertySignature(
						AST.identifier(attributeName),
						AST.tsTypeAnnotation(attributeType)
					),
					allowReadonly
				)
			}),
		])

		// embed any referenced fragments in the result
		const fragmentSpreads = selections?.filter(({ kind }) => kind === 'FragmentSpread') as
			| graphql.FragmentSpreadNode[]
			| undefined
		if (fragmentSpreads && fragmentSpreads.length) {
			result.members.push(
				readonlyProperty(
					AST.tsPropertySignature(
						AST.identifier(fragmentKey),
						AST.tsTypeAnnotation(
							AST.tsTypeLiteral(
								(fragmentSpreads || []).map((fragmentSpread) =>
									AST.tsPropertySignature(
										AST.identifier(fragmentSpread.name.value),
										AST.tsTypeAnnotation(
											AST.tsLiteralType(AST.booleanLiteral(true))
										)
									)
								)
							)
						)
					),
					allowReadonly
				)
			)
		}
	}
	// we shouldn't get here
	else {
		throw Error('Could not convert selection to typescript')
	}

	// if we are wrapping a list
	if (list) {
		// if we do not have an inner non-null, wrap it
		if (!innerNonNull) {
			result = nullable(result)
		}
		// wrap it in the list
		result = AST.tsArrayType(AST.tsParenthesizedType(result))

		// if we do not have an outer null
		if (!nonNull) {
			result = nullable(result)
		}
	} else {
		// if we aren't marked as non-null
		if (!innerNonNull && !root && !nonNull) {
			result = nullable(result)
		}
	}

	return result
}

function readonlyProperty(
	prop: recast.types.namedTypes.TSPropertySignature,
	enable: boolean = true
): recast.types.namedTypes.TSPropertySignature {
	if (enable) {
		prop.readonly = true
	}
	return prop
}

function nullable(inner: TSTypeKind, input = false) {
	// the members of the union
	const members = [inner, AST.tsNullKeyword()]
	if (input) {
		members.push(AST.tsUndefinedKeyword())
	}

	return AST.tsUnionType(members)
}

function scalarPropertyValue(target: graphql.GraphQLNamedType): TSTypeKind {
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
