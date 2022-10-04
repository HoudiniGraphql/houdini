import * as graphql from 'graphql'
import * as recast from 'recast'

import {
	Config,
	getRootType,
	hashDocument,
	HoudiniError,
	parentTypeFromAncestors,
	fs,
	CollectedGraphQLDocument,
	cleanupFiles,
} from '../../../lib'
import { ArtifactKind } from '../../../lib'
import { moduleExport } from '../../utils'
import writeIndexFile from './indexFile'
import { inputObject } from './inputs'
import { operationsByPath, FilterMap } from './operations'
import selection from './selection'
import { serializeValue } from './utils'

const AST = recast.types.builders

// the artifact generator creates files in the runtime directory for each
// document containing meta data that the preprocessor might use
export default function artifactGenerator(stats: {
	total: string[]
	new: string[]
	changed: string[]
	deleted: string[]
}) {
	return async function (config: Config, docs: CollectedGraphQLDocument[]) {
		// put together the type information for the filter for every list
		const filterTypes: FilterMap = {}

		for (const doc of docs) {
			graphql.visit(doc.document, {
				// look for any field marked with a list
				Directive(node, _, __, ___, ancestors) {
					// we only care about lists
					if (node.name.value !== config.listDirective) {
						return
					}

					// get the name of the list
					const nameArg = node.arguments?.find(
						(arg) => arg.name.value === config.listNameArg
					)
					if (!nameArg || nameArg.value.kind !== 'StringValue') {
						throw new HoudiniError({
							filepath: doc.filename,
							message: 'could not find name arg in list directive',
						})
					}
					const listName = nameArg.value.value

					// look up the actual field in the ancestor list so we can get type info
					let field = ancestors[ancestors.length - 1] as graphql.FieldNode
					let i = 1
					while (Array.isArray(field)) {
						i++
						field = ancestors[ancestors.length - i] as graphql.FieldNode
					}
					if (field.kind !== 'Field') {
						return
					}

					// look up the parent's type so we can ask about the field marked as a list
					const parentType = parentTypeFromAncestors(config.schema, doc.filename, [
						...ancestors.slice(0, -1),
					]) as graphql.GraphQLObjectType
					const parentField = parentType.getFields()[field.name.value]
					if (!parentField) {
						throw new HoudiniError({
							filepath: doc.filename,
							message: 'Could not find field information when computing filters',
						})
					}
					const fieldType = getRootType(parentField.type).toString()

					// look at every arg on the list to figure out the valid filters
					filterTypes[listName] = parentField.args.reduce((prev, arg) => {
						return {
							...prev,
							[arg.name]: getRootType(arg.type).toString(),
						}
					}, {})

					// the delete directive is an interesting one since there isn't a specific
					// list. we need to use something that points to deleting an instance of
					// the type as a key
					filterTypes[`${fieldType}_delete`] = {
						...filterTypes[`${fieldType}_delete`],
						// every field with the list type adds to the delete filters
						...filterTypes[listName],
					}
				},
			})
		}

		const listOfArtifacts: string[] = []

		// we have everything we need to generate the artifacts
		await Promise.all(
			[
				// generate the index file
				writeIndexFile(config, docs),
			].concat(
				// and an artifact for every document
				docs.map(async (doc) => {
					// pull out the info we need from the collected doc
					const { document, name, generateArtifact } = doc

					// if the document is generated, don't write it to disk - it's use is to provide definitions
					// for the other transforms
					if (!generateArtifact) {
						return
					}

					// before we can print the document, we need to strip:
					// 1. all references to internal directives
					// 2. all variables only used by internal directives
					const usedVariableNames = new Set<string>()
					let documentWithoutInternalDirectives = graphql.visit(document, {
						Directive(node) {
							// if the directive is one of the internal ones, remove it
							if (config.isInternalDirective(node)) {
								return null
							}
						},

						Variable(node, _key, parent) {
							const variableIsBeingDefined =
								parent &&
								!(parent instanceof Array) &&
								parent.kind === 'VariableDefinition'

							if (!variableIsBeingDefined) {
								usedVariableNames.add(node.name.value)
							}
						},
					})
					let documentWithoutExtraVariables = graphql.visit(
						documentWithoutInternalDirectives,
						{
							VariableDefinition(variableDefinitionNode) {
								const name = variableDefinitionNode.variable.name.value

								if (!usedVariableNames.has(name)) {
									return null
								}
							},
						}
					)
					let rawString = graphql.print(documentWithoutExtraVariables)

					// figure out the document kind
					let docKind = doc.kind

					// look for the operation
					const operations = document.definitions.filter(
						({ kind }) => kind === graphql.Kind.OPERATION_DEFINITION
					) as graphql.OperationDefinitionNode[]
					// there are no operations, so its a fragment
					const fragments = document.definitions.filter(
						({ kind }) => kind === graphql.Kind.FRAGMENT_DEFINITION
					) as graphql.FragmentDefinitionNode[]

					let rootType: string | undefined = ''
					let selectionSet: graphql.SelectionSetNode

					// if we are generating the artifact for an operation
					if (docKind !== ArtifactKind.Fragment) {
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
							throw new HoudiniError({
								filepath: doc.filename,
								message:
									'could not find root type for operation: ' +
									operation.operation +
									'. Maybe you need to re-run the introspection query?',
							})
						}

						// use this selection set
						selectionSet = operation.selectionSet
					}
					// we are looking at a fragment so use its selection set and type for the subscribe index
					else {
						// there are a lot of fragments added to a document. The fragment we care about
						// is the one with the matching name
						const matchingFragment = fragments.find(
							(fragment) => fragment.name.value === name
						)
						if (!matchingFragment) {
							throw new HoudiniError({
								filepath: doc.filename,
								message: `Fragment "${name}" doesn't exist in its own document?!`,
							})
						}
						rootType = matchingFragment.typeCondition.name.value
						selectionSet = matchingFragment.selectionSet
					}

					// if there are inputs to the operation
					const inputs = operations[0]?.variableDefinitions

					// generate a hash of the document that we can use to detect changes
					// start building up the artifact
					const artifact: Record<string, any> = {
						name,
						kind: docKind,
						hash: hashDocument(rawString),
						refetch: doc.refetch,
						raw: rawString,
						rootType,
						selection: selection({
							config,
							filepath: doc.filename,
							rootType,
							selections: selectionSet.selections,
							operations: operationsByPath(
								config,
								doc.filename,
								operations[0],
								filterTypes
							),
							// do not include used fragments if we are rendering the selection
							// for a fragment document
							includeFragments: docKind !== 'HoudiniFragment',
							document: doc,
						}),
					}

					// if the document has inputs describe their types in the artifact so we can
					// marshal and unmarshal scalars
					if (inputs && inputs.length > 0) {
						artifact.input = inputObject(config, inputs)
					}

					// add the cache policy to query documents
					if (docKind === 'HoudiniQuery') {
						const cacheDirective = operations[0].directives?.find(
							(directive) => directive.name.value === config.cacheDirective
						)
						if (cacheDirective) {
							// look for arguments
							const args: { [key: string]: graphql.ArgumentNode } =
								cacheDirective.arguments?.reduce(
									(acc, arg) => ({
										...acc,
										[arg.name.value]: arg,
									}),
									{}
								) || {}

							const policy = args[config.cachePolicyArg]
							if (policy && policy.value.kind === 'EnumValue') {
								artifact.policy = policy.value.value
							} else {
								artifact.policy = config.defaultCachePolicy
							}

							// if the user opted-in for partial data
							const partial = args[config.cachePartialArg]
							if (partial && partial.value.kind === 'BooleanValue') {
								artifact.partial = partial.value.value
							} else {
								artifact.partial = config.defaultPartial
							}
						} else {
							artifact.policy = config.defaultCachePolicy
							artifact.partial = config.defaultPartial
						}
					}

					// the artifact should be the default export of the file
					const file = AST.program([
						moduleExport(config, 'default', serializeValue(artifact)),
						AST.expressionStatement(
							AST.stringLiteral(`HoudiniHash=${hashDocument(doc.originalString)}`)
						),
					])

					const artifactPath = config.artifactPath(document)

					// don't count the document unless it's user-facing (ie, generates a store)
					const countDocument = doc.generateStore

					// check if the file exists (indicating a new document)
					let existingArtifact = await fs.readFile(artifactPath)
					if (existingArtifact === null) {
						if (countDocument) {
							stats.new.push(artifact.name)
						}
					}

					// write the result to the artifact path we're configured to write to
					await fs.writeFile(artifactPath, recast.print(file).code)
					listOfArtifacts.push(config.documentName(document))

					if (!countDocument) {
						return
					}

					// check if the artifact exists
					const match = existingArtifact && existingArtifact.match(/"HoudiniHash=(\w+)"/)
					if (match && match[1] !== hashDocument(doc.originalString)) {
						stats.changed.push(artifact.name)
					}

					// regardless of whether it was changed or not, we need to track the total list of artifacts
					stats.total.push(artifact.name)
				})
			)
		)

		// cleanup files that are no more necessary!
		stats.deleted = await cleanupFiles(config.artifactDirectory, listOfArtifacts)
	}
}
