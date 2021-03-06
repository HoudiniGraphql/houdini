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
			)
			// there are no operations, so its a fragment
			const fragments = document.definitions.filter(
				({ kind }) => kind === graphql.Kind.FRAGMENT_DEFINITION
			)

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

			// if we are generating the artifact for an operation
			if (docKind !== 'HoudiniFragment') {
				// add the field map to the artifact
				artifact.body.push(moduleExport('selectionInfo', selectionInfo(config, document)))
			}

			// write the result to the artifact path we're configured to write to
			await fs.writeFile(config.artifactPath(document), recast.print(artifact).code)

			// log the file location to confirm
			if (!config.quiet) {
				console.log(name)
			}
		})
	)
}

function selectionInfo(config: Config, document: graphql.DocumentNode) {
	// find the operation
	const operation = document.definitions.find(
		({ kind }) => kind === 'OperationDefinition'
	) as graphql.OperationDefinitionNode
	if (!operation) {
		return AST.objectExpression([])
	}

	// figure out the root type
	let rootType: string | undefined = ''
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

	// build up the fields key in the document
	const fields = buildselectionInfo(config, document, rootType, operation.selectionSet)

	return AST.objectExpression([
		AST.objectProperty(AST.identifier('rootType'), AST.stringLiteral(rootType)),
		AST.objectProperty(AST.identifier('fields'), fields),
	])
}

function buildselectionInfo(
	config: Config,
	document: graphql.DocumentNode,
	parentType: string,
	selectionSet: graphql.SelectionSetNode,
	map: namedTypes.ObjectExpression = AST.objectExpression([])
): namedTypes.ObjectExpression {
	// check if we have seen this type before
	let typeField = map.properties.find((prop) => {
		const objProp = prop as namedTypes.ObjectProperty
		return objProp.key.type === 'Literal' && objProp.key.value === parentType
	}) as namedTypes.ObjectProperty
	// if it doesn't exist, we need to add the type to the root
	if (!typeField) {
		typeField = AST.objectProperty(AST.literal(parentType), AST.objectExpression([]))
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

			buildselectionInfo(
				config,
				document,
				definition.typeCondition.name.value,
				definition.selectionSet,
				map
			)
		}
		// if we're looking at an inline fragment, keep going
		else if (selection.kind === 'InlineFragment') {
			const fragmentType = selection.typeCondition?.name.value || parentType
			buildselectionInfo(config, document, fragmentType, selection.selectionSet, map)
		}
		// its a field
		else if (selection.kind === 'Field') {
			// we need to generate a key
			const attributeName = selection.alias?.value || selection.name.value
			const key = attributeName + 'something_with_args'

			// look up the field
			const type = config.schema.getType(parentType) as graphql.GraphQLObjectType
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
				buildselectionInfo(config, document, typeName, selection.selectionSet, map)
			}
		}
	}

	// return the accumulator
	return map
}
