// externals
import { Config, selectionTypeInfo } from 'houdini-common'
import * as recast from 'recast'
import * as graphql from 'graphql'
import {
	TSTypeKind,
	StatementKind,
	TSPropertySignatureKind,
	TSTypeLiteralKind,
} from 'ast-types/gen/kinds'
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
		docs.map(async ({ originalDocument }) => {
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
	selections: readonly graphql.SelectionNode[] | undefined
	root: boolean
	allowReadonly: boolean
	body: StatementKind[]
	visitedTypes: Set<string>
}): TSTypeKind {
	// start unwrapping non-nulls and lists (we'll wrap it back up before we return)
	const { type, list, nullable, nonNull } = unwrapType(config, rootType)

	let result: TSTypeKind
	// if we are looking at a scalar field
	if (graphql.isScalarType(type)) {
		result = scalarPropertyValue(type as graphql.GraphQLNamedType)
	}
	// we could have encountered an enum
	else if (graphql.isEnumType(type)) {
		// have we seen the enum before
		if (!visitedTypes.has(type.name)) {
			// add the enum declaration to the body
			body.push(enumDeclaration(type))

			// register that we've visited the type already
			visitedTypes.add(type.name)
		}

		result = AST.tsTypeReference(AST.identifier(type.name))
	}
	// if we are looking at an object
	else if (graphql.isObjectType(type)) {
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
	// if we are looking at an interface
	else if (graphql.isInterfaceType(type) && selections && selections.length > 0) {
		// before we can begin, we need to sort the selection set for this field for
		// fields defined on the interface as well as subtypes of the interface
		const inlineFragments: graphql.InlineFragmentNode[] = []
		// the rest of the selection can be a single type in the union
		const selectedFields: graphql.SelectionNode[] = []

		for (const selection of selections) {
			// if we found an inline fragment then we have a sub-condition on the fragment
			if (selection.kind === 'InlineFragment') {
				inlineFragments.push(selection)
			} else {
				selectedFields.push(selection)
			}
		}
		// we want to build up a union of the possible options, discriminated by the
		// value of __typename
		const options: TSTypeKind[] = inlineFragments.flatMap(
			(fragment: graphql.InlineFragmentNode) => {
				// look up the type pointed by the type condition
				if (!fragment.typeCondition) {
					return []
				}
				const typeName = fragment.typeCondition.name.value
				const fragmentRootType = config.schema.getType(typeName)
				if (!fragmentRootType) {
					return []
				}

				// generate the type for the inline fragment
				const fragmentType = tsType({
					config,
					rootType: fragmentRootType,
					selections: fragment.selectionSet.selections,
					allowReadonly,
					visitedTypes,
					root,
					body,
				})

				// we need to handle __typename in the generated type. this means removing
				// it if it was declared by tsType and adding the right value
				let objectType = fragmentType
				// if we got a nullable field, we need to point at the type def
				if (fragmentType.type === 'TSUnionType') {
					for (const inner of fragmentType.types) {
						if (inner.type === 'TSTypeLiteral') {
							objectType = inner
						}
					}
				}

				if (objectType.type === 'TSTypeLiteral') {
					const existingTypenameIndex = objectType.members.findIndex(
						(member) =>
							member.type === 'TSPropertySignature' &&
							member.key.type === 'Identifier' &&
							member.key.name === '__typename'
					)
					if (existingTypenameIndex !== -1) {
						objectType.members.splice(existingTypenameIndex, 1)
					}

					// add __typename to the list
					objectType.members.push(
						readonlyProperty(
							AST.tsPropertySignature(
								AST.identifier('__typename'),
								AST.tsTypeAnnotation(AST.tsLiteralType(AST.stringLiteral(typeName)))
							),
							allowReadonly
						)
					)
				}

				// we're done massaging the type
				return [fragmentType]
			}
		)

		// before we can generate the final type, we need to sort the selections into
		result = AST.tsUnionType(options)

		// if there are selections outside of subtypes, generate them as a single type
		if (selectedFields.length > 0) {
			const restType = tsType({
				config,
				rootType: type,
				selections: selectedFields,
				allowReadonly,
				visitedTypes,
				root,
				body,
			})

			// we need to add the rest of the selection as an intersection since
			// it applies to every type
			result = AST.tsIntersectionType([result, restType])
		}
	}
	// we shouldn't get here
	else {
		throw Error('Could not convert selection to typescript')
	}

	// if we are wrapping a list
	if (list) {
		// if we do not have an inner non-null, wrap it
		if (!nonNull) {
			result = nullableField(result)
		}
		// wrap it in the list
		result = AST.tsArrayType(AST.tsParenthesizedType(result))

		// if we do not have an outer null
		if (!nullable) {
			result = nullableField(result)
		}
	} else {
		// if we aren't marked as non-null
		if (!nonNull && !root && !nullable) {
			result = nullableField(result)
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

function nullableField(inner: TSTypeKind, input = false) {
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

function enumDeclaration(type: graphql.GraphQLEnumType) {
	return AST.tsEnumDeclaration(
		AST.identifier(type.name),
		type
			.getValues()
			.map((value) =>
				AST.tsEnumMember(AST.identifier(value.name), AST.stringLiteral(value.name))
			)
	)
}
