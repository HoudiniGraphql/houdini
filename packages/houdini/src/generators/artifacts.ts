// externals
import { Config, getRootType, hashDocument } from 'houdini-common'
import * as graphql from 'graphql'
import {
	CompiledQueryKind,
	CompiledFragmentKind,
	CompiledMutationKind,
	CompiledDocumentKind,
} from '../types'
import * as recast from 'recast'
import fs from 'fs/promises'
import { namedTypes } from 'ast-types/gen/namedTypes'
// locals
import { CollectedGraphQLDocument } from '../types'
import { moduleExport } from '../utils'

const AST = recast.types.builders

// the artifact generator creates files in the runtime directory for each
// document containing meta data that the preprocessor might use
export default async function artifactGenerator(config: Config, docs: CollectedGraphQLDocument[]) {
	await Promise.all(
		docs.map(async ({ document, name, printed }) => {
			// before we can print the document, we need to strip all references to internal directives
			const rawString = graphql.print(
				graphql.visit(document, {
					Directive: {
						enter(node) {
							// if the directive is one of the internal ones, remove it
							if (config.isInternalDirective(node)) {
								return null
							}
						},
					},
				})
			)

			// figure out the document kind
			let docKind: CompiledDocumentKind | null = null

			// look for the operation
			const operations = document.definitions.filter(
				({ kind }) => kind === graphql.Kind.OPERATION_DEFINITION
			) as graphql.OperationDefinitionNode[]
			// there are no operations, so its a fragment
			const fragments = document.definitions.filter(
				({ kind }) => kind === graphql.Kind.FRAGMENT_DEFINITION
			) as graphql.FragmentDefinitionNode[]

			// if there are operations in the document
			if (operations.length > 0) {
				// figure out if its a query
				if (
					operations[0].kind === graphql.Kind.OPERATION_DEFINITION &&
					operations[0].operation === 'query'
				) {
					docKind = CompiledQueryKind
				}
				// or a mutation
				else {
					docKind = CompiledMutationKind
				}
			}
			// if there are operations in the document
			else if (fragments.length > 0) {
				docKind = CompiledFragmentKind
			}

			// if we couldn't figure out the kind
			if (!docKind) {
				throw new Error('Could not figure out what kind of document we were given')
			}

			// generate a hash of the document that we can use to detect changes
			// start building up the artifact
			const artifact = AST.program([
				moduleExport('name', AST.stringLiteral(name)),
				moduleExport('kind', AST.stringLiteral(docKind)),
				moduleExport('hash', AST.stringLiteral(hashDocument(printed))),
				moduleExport(
					'raw',
					AST.templateLiteral(
						[AST.templateElement({ raw: rawString, cooked: rawString }, true)],
						[]
					)
				),
			])

			let rootType: string | undefined = ''
			let selectionSet: graphql.SelectionSetNode

			// if we are generating the artifact for an operation
			if (docKind !== 'HoudiniFragment') {
				// find the operation
				const operation = operations[0]

				if (operation.operation === 'query') {
					rootType = config.schema.getQueryType()?.name
				} else if (operation.operation === 'mutation') {
					rootType = config.schema.getMutationType()?.name
				} else if (operation.operation === 'subscription') {
					rootType = config.schema.getSubscriptionType()?.name
				}
				if (!rootType) {
					throw new Error('Could not find root type for field map')
				}

				// use this selection set
				selectionSet = operation.selectionSet

				// add the field map to the artifact
				artifact.body.push(
					moduleExport(
						'response',
						AST.objectExpression([
							AST.objectProperty(
								AST.identifier('rootType'),
								AST.stringLiteral(rootType)
							),
							AST.objectProperty(
								AST.identifier('fields'),
								buildResponse({
									config,
									document,
									rootType,
									selectionSet,
								})
							),
						])
					)
				)
			}
			// we are looking at a fragment so use its selection set and type for the subscribe index
			else {
				rootType = fragments[0].typeCondition.name.value
				selectionSet = fragments[0].selectionSet
			}

			// add the selection information so we can subscribe to the store
			artifact.body.push(
				moduleExport('rootType', AST.stringLiteral(rootType)),
				moduleExport(
					'selection',
					selection({
						config,
						rootType,
						selectionSet: selectionSet,
					})
				)
			)

			// write the result to the artifact path we're configured to write to
			await fs.writeFile(config.artifactPath(document), recast.print(artifact).code)

			// log the file location to confirm
			if (!config.quiet) {
				console.log(name)
			}
		})
	)
}

function buildResponse({
	config,
	document,
	rootType,
	selectionSet,
	map = AST.objectExpression([]),
}: {
	config: Config
	document: graphql.DocumentNode
	rootType: string
	selectionSet: graphql.SelectionSetNode
	map?: namedTypes.ObjectExpression
}): namedTypes.ObjectExpression {
	// check if we have seen this type before
	let typeField = map.properties.find((prop) => {
		const objProp = prop as namedTypes.ObjectProperty
		return objProp.key.type === 'Literal' && objProp.key.value === rootType
	}) as namedTypes.ObjectProperty
	// if it doesn't exist, we need to add the type to the root
	if (!typeField) {
		typeField = AST.objectProperty(AST.literal(rootType), AST.objectExpression([]))
		map.properties.push(typeField)
	}

	const mapType = typeField.value as namedTypes.ObjectExpression

	// visit every selection
	for (const selection of selectionSet.selections) {
		// if we are looking at a fragment spread we need to keep walking down
		if (selection.kind === 'FragmentSpread') {
			// look up the fragment definition
			const definition = document.definitions.find(
				(defn) =>
					defn.kind === 'FragmentDefinition' && defn.name.value === selection.name.value
			) as graphql.FragmentDefinitionNode

			buildResponse({
				config,
				document,
				rootType: definition.typeCondition.name.value,
				selectionSet: definition.selectionSet,
				map,
			})
		}
		// if we're looking at an inline fragment, keep going
		else if (selection.kind === 'InlineFragment') {
			const fragmentType = selection.typeCondition?.name.value || rootType
			buildResponse({
				config,
				document,
				rootType: fragmentType,
				selectionSet: selection.selectionSet,
				map,
			})
		}
		// its a field
		else if (selection.kind === 'Field') {
			// we need to generate a key
			const attributeName = selection.alias?.value || selection.name.value
			const key = fieldKey(selection)

			// look up the field
			const type = config.schema.getType(rootType) as graphql.GraphQLObjectType
			if (!type) {
				throw new Error('Could not find type')
			}
			const typeName = getRootType(type.getFields()[selection.name.value].type).toString()

			// have we seen this attribute before, we'll get the same info we did last time
			// since a valid graphql document can't have conflicts args on a field of the
			// same {alias || name}
			const existingField = mapType.properties.find(
				(prop) =>
					prop.type === 'ObjectProperty' &&
					prop.key.type === 'Identifier' &&
					prop.key.name === attributeName
			)
			if (!existingField) {
				mapType.properties.push(
					AST.objectProperty(
						AST.literal(attributeName),
						AST.objectExpression([
							AST.objectProperty(AST.literal('key'), AST.stringLiteral(key)),
							AST.objectProperty(AST.literal('type'), AST.stringLiteral(typeName)),
						])
					)
				)
			}

			// if the field has a selection set, then we need to include it
			if (selection.selectionSet) {
				buildResponse({
					config,
					document,
					rootType: typeName,
					selectionSet: selection.selectionSet,
					map,
				})
			}
		}
	}

	// return the accumulator
	return map
}

function selection({
	config,
	rootType,
	selectionSet,
}: {
	config: Config
	rootType: string
	selectionSet: graphql.SelectionSetNode
}): namedTypes.ObjectExpression {
	// we need to build up an object that contains every field in the selection
	const object = AST.objectExpression([])

	for (const field of selectionSet.selections) {
		// ignore fragment spreads
		if (field.kind === 'FragmentSpread') {
			continue
		}
		// inline fragments should be merged with the parent
		else if (field.kind === 'InlineFragment') {
			const inlineFragment = selection({ config, rootType, selectionSet: field.selectionSet })
			for (const property of inlineFragment.properties) {
				object.properties.push(property)
			}
		}
		// fields need their own entry
		else if (field.kind === 'Field') {
			// look up the field
			const type = config.schema.getType(rootType) as graphql.GraphQLObjectType
			if (!type) {
				throw new Error('Could not find type')
			}
			const typeName = getRootType(type.getFields()[field.name.value].type).toString()

			const attributeName = field.alias?.value || field.name.value
			// the object holding data for this field
			const fieldObj = AST.objectExpression([
				AST.objectProperty(AST.literal('type'), AST.stringLiteral(typeName)),
				AST.objectProperty(AST.literal('key'), AST.stringLiteral(fieldKey(field))),
			])

			// if there is a selection set, add it to the field object
			if (
				field.selectionSet &&
				field.selectionSet.selections.filter(({ kind }) => kind !== 'FragmentSpread')
					.length > 0
			) {
				fieldObj.properties.push(
					AST.objectProperty(
						AST.literal('fields'),
						selection({
							config,
							rootType: typeName,
							selectionSet: field.selectionSet,
						})
					)
				)
			}

			object.properties.push(AST.objectProperty(AST.stringLiteral(attributeName), fieldObj))
		}
	}

	return object
}

// returns the key for a specific field
function fieldKey(field: graphql.FieldNode): string {
	const attributeName = field.alias?.value || field.name.value
	return attributeName + 'something_with_args'
}
