// externals
import {
	Config,
	selectionTypeInfo,
	isScalarType,
	isObjectType,
	isListType,
	getRootType,
} from 'houdini-common'
import * as recast from 'recast'
import fs from 'fs/promises'
import * as graphql from 'graphql'
import { TSTypeKind } from 'ast-types/gen/kinds'
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

			// if there's an operation definition
			if (originalDocument.definitions.find((def) => def.kind === 'OperationDefinition')) {
				// treat it as an operation document
				await generateOperationTypeDefs(config, typeDefPath, originalDocument)
			} else {
				// treat it as a fragment document
				await generateFragmentTypeDefs(config, typeDefPath, originalDocument)
			}
		})
	)
}

async function generateOperationTypeDefs(
	config: Config,
	path: string,
	operation: graphql.DocumentNode
) {
	// start building up the file contents
	const program = AST.program([])

	// write the file contents
	await fs.writeFile(path, recast.print(program).code, 'utf-8')
}

async function generateFragmentTypeDefs(
	config: Config,
	path: string,
	document: graphql.DocumentNode
) {
	// start building up the file contents
	const program = AST.program([])

	// every definition will contribute the same thing to the typedefs
	for (const definition of document.definitions) {
		// if its not a fragment definition
		if (definition.kind !== 'FragmentDefinition') {
			// we dont know what to do
			continue
		}

		// the name of the prop type
		const propTypeName = definition.name.value
		// the name of the shape type
		const shapeTypeName = `${definition.name.value}$data`

		const type = config.schema.getType(definition.typeCondition.name.value)
		if (!type) {
			throw new Error('Should not get here')
		}

		program.body.push(
			// we need to add a type that will act as the entry point for the fragment
			// and be assigned to the prop that holds the reference passed from
			// the fragment's parent
			AST.exportNamedDeclaration(
				AST.tsTypeAliasDeclaration(
					AST.identifier(propTypeName),
					AST.tsTypeLiteral([
						readonly(
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
					tsType(config, type, definition.selectionSet, true)
				)
			)
		)
	}

	// write the file contents
	await fs.writeFile(path, recast.print(program).code, 'utf-8')
}

function readonly(
	prop: recast.types.namedTypes.TSPropertySignature
): recast.types.namedTypes.TSPropertySignature {
	prop.readonly = true

	return prop
}

function tsType(
	config: Config,
	rootType: graphql.GraphQLNamedType,
	selectionSet: graphql.SelectionSetNode | undefined,
	root: boolean
): TSTypeKind {
	// debugger
	// @ts-ignore
	let result: TSTypeKind
	// if we are looking at a scalar field
	if (isScalarType(rootType)) {
		result = scalarPropertyValue(rootType)
	}
	// if we are looking at a list
	else if (isListType(rootType)) {
		// debugger
		result = AST.tsArrayType(
			// @ts-ignore
			AST.tsParenthesizedType(tsType(config, rootType.ofType, selectionSet, false))
		)
	}
	// if we are looking at an object
	else if (isObjectType(rootType)) {
		const rootObj = rootType as graphql.GraphQLObjectType<any, any>

		result = AST.tsTypeLiteral(
			((selectionSet?.selections || []).filter(
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
					selection.selectionSet as graphql.SelectionSetNode,
					false
				)

				// we're done
				return readonly(
					AST.tsPropertySignature(
						AST.identifier(attributeName),
						AST.tsTypeAnnotation(attributeType)
					)
				)
			})
		)
	}
	// we shouldn't get here
	else {
		throw Error('Could not convert selection to typescript')
	}

	debugger
	// if the field isn't marked non- null we need to wrap it in a | null
	if (!root && !graphql.isNonNullType(rootType)) {
		result = AST.tsUnionType([result, AST.tsNullKeyword()])
	}

	return result
}

function scalarPropertyValue(target: graphql.GraphQLNamedType): TSTypeKind {
	return AST.tsStringKeyword()
}
