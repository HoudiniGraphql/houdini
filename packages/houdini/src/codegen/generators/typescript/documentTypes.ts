import { logCyan, logGreen } from '@kitql/helper'
import type { ExpressionKind, StatementKind, TSTypeKind } from 'ast-types/lib/gen/kinds'
import type * as graphql from 'graphql'
import * as recast from 'recast'

import type { Config, Document, DocumentArtifact } from '../../../lib'
import { printJS, HoudiniError, siteURL, fs, path } from '../../../lib'
import { fragmentArgumentsDefinitions } from '../../transforms/fragmentVariables'
import { flattenSelections } from '../../utils'
import { serializeValue } from '../artifacts/utils'
import { addReferencedInputTypes } from './addReferencedInputTypes'
import { fragmentKey, inlineType } from './inlineType'
import { withLoadingState } from './loadingState'
import { tsTypeReference } from './typeReference'
import { readonlyProperty } from './types'

const AST = recast.types.builders

// typescriptGenerator generates typescript definitions for the artifacts
export async function generateDocumentTypes(config: Config, docs: Document[]) {
	// build up a list of paths we have types in (to export from index.d.ts)
	const typePaths: string[] = []

	// we need every fragment definition
	const fragmentDefinitions: { [name: string]: graphql.FragmentDefinitionNode } = {}
	for (const document of docs) {
		for (const defn of document.originalParsed.definitions.filter(
			({ kind }) => kind === 'FragmentDefinition'
		) as graphql.FragmentDefinitionNode[]) {
			fragmentDefinitions[defn.name.value] = defn
		}
	}

	const missingScalars = new Set<string>()

	// every document needs a generated type
	await Promise.all(
		// the generated types depend solely on user-provided information
		// so we need to use the original document that we haven't mutated
		// as part of the compiler
		docs.map(async (document) => {
			const {
				originalParsed: originalDocument,
				name,
				filename,
				generateArtifact: generateArtifact,
				artifact,
			} = document

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

			const selections = flattenSelections({
				config,
				filepath: filename,
				selections: definition.selectionSet.selections,
				fragmentDefinitions,
			})

			if (definition?.kind === 'OperationDefinition') {
				// treat it as an operation document
				await generateOperationTypeDefs(
					config,
					filename,
					document,
					program.body,
					definition,
					selections,
					visitedTypes,
					missingScalars,
					artifact!
				)
			} else {
				// treat it as a fragment document
				await generateFragmentTypeDefs(
					config,
					filename,
					program.body,
					selections,
					originalDocument.definitions,
					visitedTypes,
					missingScalars,
					document!
				)
			}

			// add the document's artifact as the file's default export
			program.body.push(
				// the typescript AST representing a default export in typescript
				AST.exportNamedDeclaration(
					AST.tsTypeAliasDeclaration(
						AST.identifier(`${name}$artifact`),
						convertToTs(serializeValue(artifact))
					)
				)
			)

			// write the file contents
			const { code } = await printJS(program)
			await fs.writeFile(typeDefPath, code)

			typePaths.push(typeDefPath)
		})
	)

	// now that we have every type generated, create an index file in the runtime root that exports the types
	const typeIndex = AST.program(
		typePaths
			.sort((a, b) => a.localeCompare(b))
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
				AST.exportAllDeclaration(AST.literal('./graphql'), null),
			])
	)

	// stringify the value so we can push it through the plugins
	const exportDefaultAs = ({ module, as }: { module: string; as: string }) =>
		`\nexport { default as ${as} } from "${module}"\n`
	const exportStarFrom = ({ module }: { module: string }) => `\nexport * from "${module}"\n`
	let { code: indexContent } = await printJS(typeIndex)
	for (const plugin of config.plugins) {
		if (plugin.indexFile) {
			indexContent = plugin.indexFile({
				config,
				content: indexContent,
				exportDefaultAs,
				exportStarFrom,
				pluginRoot: config.pluginDirectory(plugin.name),
				typedef: true,
				documents: docs,
			})
		}

		// if the plugin generated a runtime
		if (plugin.includeRuntime) {
			indexContent += exportStarFrom({
				module:
					'./' +
					path.relative(config.rootDir, config.pluginRuntimeDirectory(plugin.name)),
			})
		}
	}

	// write the contents
	await fs.writeFile(config.typeIndexPath, indexContent)

	// if we were missing scalars, we need to warn the user and tell them
	if (missingScalars.size > 0) {
		console.warn(`⚠️  Missing definitions for the following scalars: ${[...missingScalars].join(
			', '
		)}
Generated types will contain an any type in place of these values. To fix this, provide an equivalent
type in your config file:

{
  scalars: {
    ${logCyan(`/* in your case, something like */`)}
${[...missingScalars]
	.map(
		(c) =>
			`    ${c}: {                  ${logGreen(`// <- The GraphQL Scalar`)}
      type: "${logCyan(`YourType_${c}`)}"  ${logGreen(`// <-  The TypeScript type`)}
    }`
	)
	.join(
		`,
`
	)}
  }
}

For more information, please visit this link: ${siteURL}/api/config#custom-scalars`)
	}
}

function convertToTs(source: ExpressionKind): TSTypeKind {
	// convert the values of objects
	if (source.type === 'ObjectExpression') {
		return AST.tsTypeLiteral(
			source.properties.reduce<recast.types.namedTypes.TSPropertySignature[]>(
				(props, prop) => {
					if (
						prop.type !== 'ObjectProperty' ||
						(prop.key.type !== 'StringLiteral' && prop.key.type === 'Identifier')
					) {
						return props
					}

					return [
						...props,
						AST.tsPropertySignature(
							prop.key,
							AST.tsTypeAnnotation(convertToTs(prop.value as ExpressionKind))
						),
					]
				},
				[]
			)
		)
	}

	// convert every element in an array
	if (source.type === 'ArrayExpression') {
		return AST.tsTupleType(
			source.elements.map((element) => convertToTs(element as ExpressionKind))
		)
	}

	// handle literal types
	if (source.type === 'Literal' && typeof source.value === 'boolean') {
		return AST.tsLiteralType(AST.booleanLiteral(source.value))
	}
	if (source.type === 'Literal' && typeof source.value === 'number') {
		return AST.tsLiteralType(AST.numericLiteral(source.value))
	}
	if (source.type === 'Literal' && typeof source.value === 'string') {
		return AST.tsLiteralType(AST.stringLiteral(source.value))
	}

	// @ts-ignore
	return AST.tsLiteralType(source)
}

async function generateOperationTypeDefs(
	config: Config,
	filepath: string,
	document: Document,
	body: StatementKind[],
	definition: graphql.OperationDefinitionNode,
	selections: readonly graphql.SelectionNode[],
	visitedTypes: Set<string>,
	missingScalars: Set<string>,
	artifact: DocumentArtifact
) {
	let parentType: graphql.GraphQLCompositeType | null = null
	if (definition.operation === 'query') {
		parentType = config.schema.getQueryType()!
	} else if (definition.operation === 'mutation') {
		parentType = config.schema.getMutationType()!
	} else if (definition.operation === 'subscription') {
		parentType = config.schema.getSubscriptionType()!
	}
	if (!parentType) {
		throw new HoudiniError({ filepath, message: 'Could not find root type for document' })
	}

	// the name of the types we will define
	const inputTypeName = `${definition.name!.value}$input`
	const shapeTypeName = `${definition.name!.value}$result`
	const optimisticTypeName = `${definition.name!.value}$optimistic`

	// dry
	const hasInputs = definition.variableDefinitions && definition.variableDefinitions.length > 0

	let resultType = inlineType({
		config,
		filepath,
		rootType: parentType,
		selections,
		root: true,
		allowReadonly: true,
		visitedTypes,
		body,
		missingScalars,
		includeFragments: true,
		field: null,
	})

	// if we are looking at a query then we should add the loading state
	if (artifact.kind === 'HoudiniQuery') {
		resultType = withLoadingState({
			body,
			base: resultType,
			config,
			document,
		})
	}

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
							AST.tsTypeAnnotation(AST.tsTypeReference(AST.identifier(inputTypeName)))
						)
					),
					readonlyProperty(
						AST.tsPropertySignature(
							AST.stringLiteral('result'),
							AST.tsTypeAnnotation(
								definition.operation === 'mutation'
									? AST.tsTypeReference(AST.identifier(shapeTypeName))
									: AST.tsUnionType([
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
			AST.tsTypeAliasDeclaration(AST.identifier(shapeTypeName), resultType)
		)
	)

	// if there are variables in this query
	if (hasInputs && definition.variableDefinitions && definition.variableDefinitions.length > 0) {
		for (const variableDefinition of definition.variableDefinitions) {
			addReferencedInputTypes(
				config,
				filepath,
				body,
				visitedTypes,
				missingScalars,
				variableDefinition.type
			)
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
									AST.tsTypeAnnotation(
										tsTypeReference(config, missingScalars, definition, body)
									),
									definition.type.kind !== 'NonNullType'
								)
							}
						)
					)
				)
			)
		)
	} else {
		body.push(
			AST.exportNamedDeclaration(
				AST.tsTypeAliasDeclaration(AST.identifier(inputTypeName), AST.tsNullKeyword())
			)
		)
	}

	// mutations need to have an optimistic response type defined
	if (definition.operation === 'mutation') {
		body.push(
			AST.exportNamedDeclaration(
				AST.tsTypeAliasDeclaration(
					AST.identifier(optimisticTypeName),
					inlineType({
						config,
						filepath,
						rootType: parentType,
						selections,
						root: true,
						allowReadonly: true,
						visitedTypes,
						body,
						missingScalars,
						includeFragments: false,
						allOptional: true,
						field: null,
					})
				)
			)
		)
	}
}

async function generateFragmentTypeDefs(
	config: Config,
	filepath: string,
	body: StatementKind[],
	selections: readonly graphql.SelectionNode[],
	definitions: readonly graphql.DefinitionNode[],
	visitedTypes: Set<string>,
	missingScalars: Set<string>,
	document: Document
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
		const inputTypeName = `${definition.name!.value}$input`

		// look up the root type of the document
		const type = config.schema.getType(definition.typeCondition.name.value)
		if (!type) {
			throw new Error('Should not get here')
		}

		// a fragment's inputs are always {} unless it has been tagged with the arguments directive
		let directive = definition.directives?.find(
			(directive) => directive.name.value === config.argumentsDirective
		)
		let inputValue = !directive
			? AST.tsTypeLiteral([])
			: AST.tsTypeLiteral(
					(fragmentArgumentsDefinitions(config, filepath, definition) || []).map(
						(definition: graphql.VariableDefinitionNode) => {
							// add a property describing the variable to the root object
							return AST.tsPropertySignature(
								AST.identifier(definition.variable.name.value),
								AST.tsTypeAnnotation(
									tsTypeReference(config, missingScalars, definition, body)
								),
								definition.type.kind !== 'NonNullType'
							)
						}
					)
			  )

		body.push(
			AST.exportNamedDeclaration(
				AST.tsTypeAliasDeclaration(AST.identifier(inputTypeName), inputValue)
			),
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
											AST.tsTypeAnnotation(AST.tsAnyKeyword())
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
					withLoadingState({
						config,
						document,
						body,
						base: inlineType({
							config,
							filepath,
							rootType: type,
							selections,
							root: true,
							allowReadonly: true,
							body,
							visitedTypes,
							missingScalars,
							includeFragments: true,
							field: null,
						}),
					})
				)
			)
		)
	}
}
