import * as graphql from 'graphql'
import * as recast from 'recast'

import {
	Config,
	Document,
	DocumentArtifact,
	CachePolicies,
	SubscriptionSelection,
	QueryArtifact,
	hashOriginal,
	hashRaw,
} from '../../../lib'
import {
	printJS,
	ArtifactKind,
	cleanupFiles,
	fs,
	getRootType,
	HoudiniError,
	parentTypeFromAncestors,
} from '../../../lib'
import { flattenSelections, moduleExport } from '../../utils'
import { fragmentArgumentsDefinitions } from '.././../transforms/fragmentVariables'
import writeIndexFile from './indexFile'
import { inputObject } from './inputs'
import type { FilterMap } from './operations'
import { operationsByPath } from './operations'
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
	hashSize: number[]
	querySize: number[]
}) {
	return async function (config: Config, docs: Document[]) {
		// put together the type information for the filter for every list
		const filterTypes: FilterMap = {}

		for (const doc of docs) {
			graphql.visit(doc.document, {
				// look for any field marked with a list
				Directive(node, _, __, ___, ancestors) {
					// now, we only care about lists
					if (node.name.value !== config.listDirective) {
						return
					}

					// get the name of the list
					const nameArg = node.arguments?.find(
						(arg) => arg.name.value === config.listOrPaginateNameArg
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

		// figure out the function we'll use to hash
		const hashPluginBaseRaw = config.plugins?.find((plugin) => plugin.hash)?.hash ?? hashRaw

		// we have everything we need to generate the artifacts
		await Promise.all(
			[
				// generate the index file
				writeIndexFile(config, docs),
			].concat(
				// and an artifact for every document
				docs.map(async (doc) => {
					// pull out the info we need from the collected doc
					const { document, name, generateArtifact, originalParsed } = doc
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
							if (config.isInternalDirective(node.name.value)) {
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
					let originalSelectionSet: graphql.SelectionSetNode | null = null

					const fragmentDefinitions = doc.document.definitions
						.filter<graphql.FragmentDefinitionNode>(
							(definition): definition is graphql.FragmentDefinitionNode =>
								definition.kind === 'FragmentDefinition'
						)
						.reduce(
							(prev, definition) => ({
								...prev,
								[definition.name.value]: definition,
							}),
							{}
						)

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
						if (originalParsed.definitions[0].kind === 'OperationDefinition') {
							originalSelectionSet = originalParsed.definitions[0].selectionSet
						}
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
						if (originalParsed.definitions[0].kind === 'FragmentDefinition') {
							originalSelectionSet = originalParsed.definitions[0].selectionSet
						}
					}

					if (!originalSelectionSet) {
						throw new Error('Not original selection set!')
					}

					// if there are inputs to the operation
					let inputs = operations[0]?.variableDefinitions
					// if we are looking at fragments, the inputs to the fragment
					// are defined with the arguments directive
					let directive = fragments[0]?.directives?.find(
						(directive) => directive.name.value === config.argumentsDirective
					)
					if (docKind === ArtifactKind.Fragment && directive) {
						inputs = fragmentArgumentsDefinitions(config, doc.filename, fragments[0])
					}

					// we need to look for global loading toggles on queries and fragments
					let globalLoading = false
					if (['HoudiniFragment', 'HoudiniQuery'].includes(docKind)) {
						globalLoading = Boolean(
							fragments[0]?.directives?.find(
								(dir) => dir.name.value === config.loadingDirective
							) ??
								operations[0]?.directives?.find(
									(dir) => dir.name.value === config.loadingDirective
								)
						)
					}

					// start building up the artifact
					let artifact: DocumentArtifact = {
						name,
						kind: docKind,
						hash: 'NOT_YET', // it will be set just after on purpose.
						refetch: doc.refetch,
						raw: rawString,
						rootType,
						selection: selection({
							config,
							filepath: doc.filename,
							document: doc,
							rootType,
							globalLoading,
							includeFragments: doc.kind !== ArtifactKind.Fragment,

							// in order to simplify the selection generation, we want to merge fragments together
							selections: flattenSelections({
								config,
								filepath: doc.filename,
								selections: selectionSet.selections,
								fragmentDefinitions,
								applyFragments: doc.kind !== ArtifactKind.Fragment,
							}),

							operations: operationsByPath(
								config,
								doc.filename,
								operations[0],
								filterTypes
							),
						}),
						pluginData: {},
					}
					// generate a hash of the document that we can use to detect changes
					// we write the hash only at this stage, because plugins can take adventage of artifacts to write the hash.
					const hash_value = hashPluginBaseRaw({ config, document: { ...doc, artifact } })
					artifact.hash = hash_value

					const persistedQuery = await config.isPersistedQueriesEnable()
					if (persistedQuery) {
						artifact.persistedQuery = true
					}

					// apply the visibility mask to the artifact so that only
					// fields in the direct selection are visible
					applyMask(
						config,
						artifact.selection,
						selection({
							config,
							filepath: doc.filename,
							rootType,
							operations: {},
							document: doc,
							selections: flattenSelections({
								config,
								filepath: doc.filename,
								selections: selectionSet.selections,
								fragmentDefinitions,
							}),
						})
					)

					// if we are looking at a query or fragment then we need to add
					// the loading state flag
					if (docKind === 'HoudiniQuery' || docKind === 'HoudiniFragment') {
						// NOTE: this logic is copied and pasted in the selection.js to track continue behavior
						const childFields = Object.values(artifact.selection?.fields ?? {}).concat(
							Object.values(artifact.selection?.abstractFields?.fields ?? {}).flatMap(
								(fieldMap) => Object.values(fieldMap ?? {})
							)
						)

						if (globalLoading || childFields.some((field) => field.loading)) {
							;(artifact as QueryArtifact).enableLoadingState = globalLoading
								? 'global'
								: 'local'
						}
					}

					// adding artifactData of plugins (only if any information is present)
					artifact.pluginData = {}
					for (const plugin of config.plugins) {
						if (!plugin.artifactData) {
							continue
						}
						artifact.pluginData[plugin.name] =
							plugin.artifactData({ config, document: doc }) ?? {}
					}

					// if the document has inputs describe their types in the artifact so we can
					// marshal and unmarshal scalars
					if (inputs && inputs.length > 0) {
						artifact.input = inputObject(config, inputs)
					}

					// add the cache policy to query documents
					if (artifact.kind === 'HoudiniQuery') {
						// cache
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
							if (policy && policy.value.kind === 'EnumValue' && policy.value.value) {
								artifact.policy = policy.value.value as CachePolicies
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

					// assign the artifact
					doc.artifact = artifact

					// pass the artifact through the artifactEnd hooks
					for (const plugin of config.plugins) {
						if (!plugin.artifactEnd) {
							continue
						}
						plugin.artifactEnd({ config, document: doc })
					}

					// the artifact should be the default export of the file
					const file = AST.program([
						moduleExport(config, 'default', serializeValue(artifact)),
						AST.expressionStatement(
							AST.stringLiteral(`HoudiniHash=${hashOriginal({ document: doc })}`)
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
					const { code } = await printJS(file)
					await fs.writeFile(artifactPath, code)
					listOfArtifacts.push(config.documentName(document))

					if (!countDocument) {
						return
					}

					// check if the artifact exists
					const match = existingArtifact && existingArtifact.match(/"HoudiniHash=(\w+)"/)
					if (match && match[1] !== artifact.hash) {
						stats.changed.push(artifact.name)
					}

					// regardless of whether it was changed or not, we need to track the total list of artifacts
					stats.total.push(artifact.name)

					// let's count only this as varaibles will need to be passed anyway.
					stats.hashSize.push(artifact.hash.length)
					stats.querySize.push(artifact.raw.length)
				})
			)
		)

		// cleanup files that are no more necessary!
		stats.deleted = await cleanupFiles(config.artifactDirectory, listOfArtifacts)
	}
}

// applyMask takes 2 selections. the first is the target whose selection should be updated
// according to the fields in the second selection
function applyMask(config: Config, target: SubscriptionSelection, mask: SubscriptionSelection) {
	// we might need to map types from this fragment onto the possible types of the parent query
	// we need to look at every field in the mask and mark it as visible in the target

	// the concrete selection of the mask acts as a mask for all of the abstract selections
	// so we want to build up a list of all of the fields at this level and apply the mask
	const targetFields = Object.entries(target.fields ?? {}).concat(
		Object.values(target.abstractFields?.fields ?? {})
			// @ts-ignore
			.flatMap((typeMap) => Object.entries(typeMap))
	)
	for (const [fieldName, value] of Object.entries(mask.fields ?? {})) {
		for (const [potentialFieldName, targetSelection] of targetFields) {
			if (fieldName !== potentialFieldName) {
				continue
			}

			// if the field is not recognized in the target, ignore it
			if (!targetSelection) {
				continue
			}

			// the field is present in the mask so mark it visible
			targetSelection.visible = true

			if (targetSelection.selection && value.selection) {
				applyMask(config, targetSelection.selection, value.selection)
			}
		}
	}

	// we've gone through all of the fields, now we need to go through the abstract fields
	for (const [type, selection] of Object.entries(mask.abstractFields?.fields ?? {})) {
		// applying the abstract fields object is a little trickier since we need to map the
		// mask type onto all of the possible types that it could be
		if (!selection) {
			continue
		}

		// if the type is present in both selections, apply that first
		if (target.abstractFields?.fields[type]) {
			applyMask(config, { fields: target.abstractFields.fields[type] }, { fields: selection })
		}

		// look up the type in the schema so we can figure out if its abstract
		const targetType = config.schema.getType(type)
		if (!targetType) {
			continue
		}

		// if we have an abstract type then we need to look for overlap with the other entries in the
		// target's abstract selection
		if (graphql.isAbstractType(targetType)) {
			// we need the list of possible types to look for overlaps
			for (const possible of config.schema.getPossibleTypes(targetType)) {
				if (target.abstractFields?.fields[possible.name]) {
					applyMask(
						config,
						{ fields: target.abstractFields.fields[possible.name] },
						{ fields: selection }
					)
				}
			}
		}

		// if the type maps to another type in the selection, use the mapped type
		const mappedType = target.abstractFields?.typeMap[type]
		if (target.abstractFields && mappedType && target.abstractFields.fields[mappedType]) {
			applyMask(
				config,
				{ fields: target.abstractFields.fields[mappedType] },
				{ fields: selection }
			)
		}
	}
}
