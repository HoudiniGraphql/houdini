// externals
import * as recast from 'recast'
import * as graphql from 'graphql'
import { StatementKind } from 'ast-types/gen/kinds'
import path from 'path'
// locals
import { Config } from '../../../common'
import { CollectedGraphQLDocument } from '../../types'
import { flattenSelections, writeFile } from '../../utils'
import { addReferencedInputTypes } from './addReferencedInputTypes'
import { tsTypeReference } from './typeReference'
import { readonlyProperty } from './types'
import { fragmentKey, inlineType } from './inlineType'

const AST = recast.types.builders

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
		docs.map(async ({ originalDocument, name, kind, generateArtifact }) => {
			if (!generateArtifact) {
				return
			}

			// the place to put the artifact's type definition
			const typeDefPath = config.artifactTypePath(originalDocument)

			// build up the program
			const program = AST.program([])

			// if we have to define any types along the way, make sure we only do it once
			const visitedTypes = new Set<string>()

			// if there's an operation definition
			let definition = originalDocument.definitions.find(
				(def) =>
					(def.kind === 'OperationDefinition' || def.kind === 'FragmentDefinition') &&
					def.name?.value === name
			) as graphql.OperationDefinitionNode | graphql.FragmentDefinitionNode

			// de-dupe/flatten the selection of the definition
			const selections = flattenSelections({
				config,
				selections: definition.selectionSet.selections,
			})

			if (definition?.kind === 'OperationDefinition') {
				// treat it as an operation document
				await generateOperationTypeDefs(
					config,
					program.body,
					definition,
					selections,
					visitedTypes
				)
			} else {
				// treat it as a fragment document
				await generateFragmentTypeDefs(
					config,
					program.body,
					selections,
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
			.concat([
				AST.exportAllDeclaration(AST.literal('./runtime'), null),
				AST.exportAllDeclaration(AST.literal('./stores'), null),
			])
	)

	// write the contents
	await writeFile(config.typeIndexPath, recast.print(typeIndex).code)
}

async function generateOperationTypeDefs(
	config: Config,
	body: StatementKind[],
	definition: graphql.OperationDefinitionNode,
	selections: readonly graphql.SelectionNode[],
	visitedTypes: Set<string>
) {
	// the name of the types we will define
	const inputTypeName = `${definition.name!.value}$input`
	const shapeTypeName = `${definition.name!.value}$result`
	const afterLoadTypeName = `${definition.name!.value}$afterLoad`

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
	const hasInputs = definition.variableDefinitions && definition.variableDefinitions.length > 0

	// add our types to the body
	body.push(
		// add the root type named after the document that links the input and result types
		AST.exportNamedDeclaration(
			AST.tsTypeAliasDeclaration(
				AST.identifier(definition.name!.value),
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
								AST.tsUnionType([
									AST.tsTypeReference(AST.identifier(shapeTypeName)),
									AST.tsUndefinedKeyword(),
								])
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
				inlineType({
					config,
					rootType: type,
					selections,
					root: true,
					allowReadonly: true,
					visitedTypes,
					body,
				})
			)
		)
	)

	// generate type for the afterload function
	const properties: ReturnType<typeof readonlyProperty>[] = [
		readonlyProperty(
			AST.tsPropertySignature(
				AST.stringLiteral('data'),
				AST.tsTypeAnnotation(
					AST.tsTypeLiteral([
						readonlyProperty(
							AST.tsPropertySignature(
								AST.stringLiteral(definition.name!.value),
								AST.tsTypeAnnotation(
									AST.tsTypeReference(AST.identifier(shapeTypeName))
								)
							)
						),
					])
				)
			)
		),
	]

	if (hasInputs) {
		properties.splice(
			0,
			0,
			readonlyProperty(
				AST.tsPropertySignature(
					AST.stringLiteral('input'),
					AST.tsTypeAnnotation(
						AST.tsTypeLiteral([
							readonlyProperty(
								AST.tsPropertySignature(
									AST.stringLiteral(definition.name!.value),
									AST.tsTypeAnnotation(
										AST.tsTypeReference(AST.identifier(inputTypeName))
									)
								)
							),
						])
					)
				)
			)
		)
	}

	if (definition.operation === 'query') {
		body.push(
			AST.exportNamedDeclaration(
				AST.tsTypeAliasDeclaration(
					AST.identifier(afterLoadTypeName),
					AST.tsTypeLiteral(properties)
				)
			)
		)
	}

	// if there are variables in this query
	if (hasInputs && definition.variableDefinitions && definition.variableDefinitions.length > 0) {
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
							(definition: graphql.VariableDefinitionNode) => {
								// add a property describing the variable to the root object
								return AST.tsPropertySignature(
									AST.identifier(definition.variable.name.value),
									AST.tsTypeAnnotation(tsTypeReference(config, definition)),
									definition.type.kind !== 'NonNullType'
								)
							}
						)
					)
				)
			)
		)
	}
}

async function generateFragmentTypeDefs(
	config: Config,
	body: StatementKind[],
	selections: readonly graphql.SelectionNode[],
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
					inlineType({
						config,
						rootType: type,
						selections,
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
