// externals
import { Config, selectionTypeInfo, isScalarType, isObjectType, isListType } from 'houdini-common'
import * as recast from 'recast'
import fs from 'fs/promises'
import * as graphql from 'graphql'
import { TSTypeKind, StatementKind, TSPropertySignatureKind } from 'ast-types/gen/kinds'
// locals
import { CollectedGraphQLDocument } from '../types'

const AST = recast.types.builders

// typescriptGenerator generates typescript definitions for the artifacts
export default async function typescriptGenerator(
	config: Config,
	docs: CollectedGraphQLDocument[]
) {
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

			// if there's an operation definition
			if (originalDocument.definitions.find((def) => def.kind === 'OperationDefinition')) {
				// treat it as an operation document
				await generateOperationTypeDefs(config, program.body, originalDocument.definitions)
			} else {
				// treat it as a fragment document
				await generateFragmentTypeDefs(config, program.body, originalDocument.definitions)
			}

			// write the file contents
			await fs.writeFile(typeDefPath, recast.print(program).code, 'utf-8')
		})
	)
}

async function generateOperationTypeDefs(
	config: Config,
	body: StatementKind[],
	definitions: readonly graphql.DefinitionNode[]
) {
	// handle any fragment definitions
	await generateFragmentTypeDefs(
		config,
		body,
		definitions.filter(({ kind }) => kind === 'FragmentDefinition')
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
									AST.tsTypeReference(AST.identifier(inputTypeName))
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
					tsType(config, type, [...definition.selectionSet.selections], true, true)
				)
			)
		)

		// if there are variables in this query
		if (definition.variableDefinitions && definition.variableDefinitions.length > 0) {
			// merge all of the variables into a single object
			body.push(
				AST.exportNamedDeclaration(
					AST.tsTypeAliasDeclaration(
						AST.identifier(inputTypeName),
						AST.tsTypeLiteral(
							definition.variableDefinitions.map(
								(definition: graphql.VariableDefinitionNode) =>
									// add a property describing the variable to the root object
									AST.tsPropertySignature(
										AST.identifier(definition.variable.name.value),
										AST.tsTypeAnnotation(inputType(config, definition))
									)
							)
						)
					)
				)
			)
		}
	}
}

// return the property
const inputType = (config: Config, definition: { type: graphql.TypeNode }): TSTypeKind => {
	let type = definition.type
	// start unwrapping non-nulls and lists (we'll wrap it back up before we return)
	let nonNull = false
	if (type.kind === 'NonNullType') {
		type = type.type
		nonNull = true
	}
	let list = false
	if (type.kind === 'ListType') {
		type = type.type
		list = true
	}
	let innerNonNull = false
	if (type.kind === 'NonNullType') {
		type = type.type
		innerNonNull = true
	}

	// make typescript happy
	if (type.kind !== 'NamedType' && !graphql.isNamedType(type) && !graphql.isScalarType(type)) {
		throw new Error('Too many wrappers')
	}
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
		result = AST.tsTypeLiteral(
			Object.values(definitionType.getFields()).map((field) => {
				return AST.tsPropertySignature(
					AST.identifier(field.name),
					// @ts-ignore
					AST.tsTypeAnnotation(inputType(config, field))
				)
			})
		)
	}

	// if we have an inner non-null
	if (!innerNonNull) {
		result = AST.tsUnionType([result, AST.tsNullKeyword(), AST.tsUndefinedKeyword()])
	}
	// list?
	if (list) {
		result = AST.tsArrayType(result)
	}
	// wrap it again
	if (list && !nonNull) {
		result = AST.tsUnionType([result, AST.tsNullKeyword(), AST.tsUndefinedKeyword()])
	}

	// return the property describing the variable
	return result
}

async function generateFragmentTypeDefs(
	config: Config,
	body: StatementKind[],
	definitions: readonly graphql.DefinitionNode[]
) {
	// every definition will contribute the same thing to the typedefs
	for (const definition of definitions) {
		// if its not a fragment definition
		if (definition.kind !== 'FragmentDefinition') {
			// we dont know what to do
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
					tsType(config, type, [...definition.selectionSet.selections], true, true)
				)
			)
		)
	}
}

function tsType(
	config: Config,
	rootType: graphql.GraphQLNamedType,
	selections: graphql.SelectionNode[] | undefined,
	root: boolean,
	allowReadonly: boolean
): TSTypeKind {
	let result: TSTypeKind
	// if we are looking at a scalar field
	if (isScalarType(rootType)) {
		result = scalarPropertyValue(rootType)
	}
	// if we are looking at a list
	else if (isListType(rootType)) {
		result = AST.tsArrayType(
			// @ts-ignore
			AST.tsParenthesizedType(tsType(config, rootType.ofType, selections, false))
		)
	}
	// if we are looking at an object
	else if (isObjectType(rootType)) {
		const rootObj = rootType as graphql.GraphQLObjectType<any, any>

		result = AST.tsTypeLiteral(
			((selections || []).filter(
				(field) => field.kind === 'Field'
			) as graphql.FieldNode[]).map((selection) => {
				// grab the type info for the selection
				const { type, field } = selectionTypeInfo(config.schema, rootObj, selection)

				// figure out the response name
				const attributeName = selection.alias?.value || selection.name.value

				// figure out the corresponding typescript type
				let attributeType = tsType(
					config,
					field.type as graphql.GraphQLNamedType,
					selection.selectionSet?.selections as graphql.SelectionNode[],
					false,
					allowReadonly
				)

				// we're done
				return readonlyProperty(
					AST.tsPropertySignature(
						AST.identifier(attributeName),
						AST.tsTypeAnnotation(attributeType)
					),
					allowReadonly
				)
			})
		)
	}
	// we shouldn't get here
	else {
		throw Error('Could not convert selection to typescript')
	}

	// if the field isn't marked non- null we need to wrap it in a | null
	if (!root && !graphql.isNonNullType(rootType)) {
		result = AST.tsUnionType([result, AST.tsNullKeyword()])
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
