// externals
import { Config, selectionTypeInfo, isScalarType, isObjectType, isListType } from 'houdini-common'
import * as recast from 'recast'
import * as graphql from 'graphql'
import { TSTypeKind, StatementKind } from 'ast-types/gen/kinds'

const AST = recast.types.builders

const fragmentKey = '$fragments'

export async function addOperationTypeDefs(
	config: Config,
	body: StatementKind[],
	definitions: readonly graphql.DefinitionNode[]
) {
	// handle any fragment definitions
	await addFragmentTypeDefs(
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
					tsType(config, type, [...definition.selectionSet.selections], true, true)
				)
			)
		)

		// if there are variables in this query
		if (hasInputs) {
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
	if (type instanceof graphql.GraphQLNonNull) {
		nonNull = true
		// @ts-ignore
		type = type.ofType
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
	if (type instanceof graphql.GraphQLNonNull) {
		innerNonNull = true
		// @ts-ignore
		type = type.ofType
	}

	// make typescript happy
	if (type.kind !== 'NamedType' && !graphql.isNamedType(type) && !graphql.isScalarType(type)) {
		throw new Error('Too many wrappers: ' + type.kind)
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

	// return the property describing the variable
	return result
}

export async function addFragmentTypeDefs(
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
	// start unwrapping non-nulls and lists (we'll wrap it back up before we return)
	let type: graphql.GraphQLNullableType = rootType
	let nonNull = false
	if (type instanceof graphql.GraphQLNonNull) {
		type = type.ofType
		nonNull = true
	}
	let list = false
	if (type instanceof graphql.GraphQLList) {
		type = type.ofType
		list = true
	}
	let innerNonNull = false
	if (type instanceof graphql.GraphQLNonNull) {
		type = type.ofType
		innerNonNull = true
	}
	let result: TSTypeKind
	// if we are looking at a scalar field
	if (isScalarType(type)) {
		result = scalarPropertyValue(type as graphql.GraphQLNamedType)
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
