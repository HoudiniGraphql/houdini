// externals
import { Config, isListType, isObjectType, getRootType, selectionTypeInfo } from 'houdini-common'
import * as graphql from 'graphql'
// locals
import { CollectedGraphQLDocument, Patch } from '../../types'
import { patchesForSelectionSet, generatePatches } from './patches'
import { generateLinks } from './links'
import { HoudiniErrorTodo } from '../../error'

// We consider every query and every mutation that could affect it. We'll start by looking at every field
// addressed by every mutation and then look at every query and fragment to see if it asks for the type.
// If so, then we need to generate something the runtime can use.
//
// note: This can only possibly happen if we get the {id} of the type in the payload so we need to check
// 		 for that along the way

// keep track of which mutation affects which fields of which type
// we need to map types to fields to the mutations that update it
export type MutationMap = {
	[typeName: string]: {
		fields: {
			[fieldName: string]: {
				[mutationName: string]: string[]
			}
		}
		operations: {
			[connectionName: string]: {
				[mutationName: string]: {
					kind: keyof Patch['operations']
					insertLocation: 'start' | 'end'
					parentID: {
						kind: 'Variable' | 'String' | 'Root'
						value: string
					}
					path: string[]
				}
			}
		}
	}
}

// another intermediate type used when building up the mutation description
export type PatchAtom = {
	parentID?: {
		kind: 'Variable' | 'String' | 'Root'
		value: string
	}
	operation: keyof Patch['operations'] | 'update'
	mutationName: string
	mutationPath: string[]
	queryName: string
	queryPath: string[]
}

export default async function mutationGenerator(config: Config, docs: CollectedGraphQLDocument[]) {
	// build up a map of mutations to the types they modify
	const mutationTargets: MutationMap = {}

	// pull the schema out
	const { schema } = config

	// look at every document for one containing a mutation
	for (const { name, document } of docs) {
		// look for a mutation definition in the document
		const definition = document.definitions.find(
			(definition) =>
				definition.kind === graphql.Kind.OPERATION_DEFINITION &&
				definition.operation === 'mutation'
		) as graphql.OperationDefinitionNode

		// if there isn't one, we dont care about this document
		if (!definition) {
			continue
		}

		// the first level of selections are the mutations triggered by the document
		// we can push it through the recursion like normal. we'll only run into problems
		// if one of the mutations is named or aliased 'id'
		if (
			definition.selectionSet.selections.find(
				(selection) =>
					selection.kind === graphql.Kind.FIELD &&
					(selection.alias?.value || selection.name.value) === 'id'
			)
		) {
			throw new Error('Encountered mutation named id.')
		}

		const mutationType = schema.getMutationType()
		if (!mutationType) {
			throw new Error('Schema does not have a mutation type defined.')
		}

		// collect all of the fields referenced by the mutation
		// and fragments within the mutation since those are the fields that we
		// will update in response to the mutation
		fillMutationMap(config, mutationTargets, name, mutationType, definition.selectionSet, [])
	}

	// now that we know which fields the mutation can update we can walk through every document
	// and look for queries or fragments that intersect with the fields changed by the mutations
	const patches: PatchAtom[] = []

	// we will run into the same document many times so we have to make sure we are only processing a document once
	const _docsVisited: { [name: string]: boolean } = {}

	// every document with a query might have an patch with a mutation, the compiler identifier
	// doesn't matter because multiple documents could include the same fragment.
	for (const definition of docs.flatMap(({ document }) => document.definitions)) {
		// we only care about fragments or query definitions
		if (
			definition.kind !== graphql.Kind.FRAGMENT_DEFINITION &&
			(definition.kind !== graphql.Kind.OPERATION_DEFINITION ||
				definition.operation !== 'query')
		) {
			continue
		}
		// if there's no name (shouldn't make it this far but lets keep typescript happy)
		if (!definition.name) {
			throw new Error('Encountered document with no name')
		}

		// if we have seen this document already, ignore it
		if (_docsVisited[definition.name.value]) {
			continue
		}

		// find the root type
		const rootType =
			definition.kind === graphql.Kind.OPERATION_DEFINITION
				? schema.getQueryType()
				: (schema.getType(definition.typeCondition.name.value) as graphql.GraphQLObjectType<
						any,
						any
				  >)

		// make sure we found something
		if (!rootType) {
			throw new Error('could not find root type for document: ' + definition.name.value)
		}

		// compute and add the patches
		patches.push(
			...patchesForSelectionSet(
				config,
				mutationTargets,
				definition.name.value,
				rootType,
				definition.selectionSet
			)
		)

		// we're done with this document
		_docsVisited[definition.name.value] = true
	}

	await Promise.all([
		// generate the patch descriptions
		generatePatches(config, patches),
		// create the link files
		generateLinks(config, patches),
	])
}

function fillMutationMap(
	config: Config,
	mutationTargets: MutationMap,
	name: string,
	rootType: graphql.GraphQLObjectType<any, any>,
	selectionSet: graphql.SelectionSetNode,
	path: string[]
) {
	// only consider fields in this selection if we have the id present
	const useFields = selectionSet.selections.find(
		(selection) => selection.kind === graphql.Kind.FIELD && selection.name.value === 'id'
	)

	// every field in the selection set could contribute to the mutation's targets
	for (const selection of selectionSet.selections) {
		// make sure there is an entry in the target map for this type
		if (!mutationTargets[rootType.name]) {
			mutationTargets[rootType.name] = {
				fields: {},
				operations: {},
			}
		}

		// fragment spreads can short circuit cache invalidation (not yet implemented)
		// or be used to describe operations on connections
		if (selection.kind === graphql.Kind.FRAGMENT_SPREAD) {
			// if the fragment indicates a connection operation
			if (config.isConnectionFragment(selection.name.value)) {
				// the name of the mutation
				const mutationName = name

				if (!mutationTargets[rootType.name]) {
					mutationTargets[rootType.name] = {
						fields: {},
						operations: {},
					}
				}

				// if this is the first time we've seen this m
				if (!mutationTargets[rootType.name].operations[selection.name.value]) {
					mutationTargets[rootType.name].operations[selection.name.value] = {}
				}

				// look at the directices applies to the spread for meta data about the mutation
				let parentID = 'root'
				let parentKind: 'Root' | 'Variable' | 'String' = 'Root'
				let insertLocation: MutationMap[string]['operations'][string][string]['insertLocation'] =
					'end'

				const internalDirectives = selection.directives?.filter((directive) =>
					config.isInternalDirective(directive)
				)
				if (internalDirectives && internalDirectives.length > 0) {
					// is prepend applied?
					const prepend = internalDirectives.find(
						({ name }) => name.value === config.connectionPrependDirective
					)
					// is append applied?
					const append = internalDirectives.find(
						({ name }) => name.value === config.connectionAppendDirective
					)

					// if both are applied, there's a problem
					if (append && prepend) {
						throw new Error('WRAP THIS IN A HOUDINI ERROR. you have both applied')
					}
					insertLocation = prepend ? 'start' : 'end'

					// look for the parentID argument
					const parentIDArg = (append || prepend)?.arguments?.find(
						({ name }) => name.value === config.connectionDirectiveParentIDArg
					)
					if (parentIDArg) {
						// if the argument is a string
						if (parentIDArg.value.kind === 'StringValue') {
							// use its value
							parentID = parentIDArg.value.value
							parentKind = 'String'
						} else if (parentIDArg.value.kind === 'Variable') {
							parentKind = 'Variable'
							parentID = parentIDArg.value.name.value
						}
					}
				}

				// we need to add an operation to the list for this open
				mutationTargets[rootType.name].operations[selection.name.value][mutationName] = {
					parentID: {
						kind: parentKind,
						value: parentID,
					},
					insertLocation,
					kind: 'add',
					path,
				}
			}

			continue
		}

		// process inline fragments
		if (selection.kind === graphql.Kind.INLINE_FRAGMENT) {
			continue
		}

		// look up the type of the selection
		const info = selectionTypeInfo(config.schema, rootType, selection)

		const { type, field } = info

		// if we are looking at a normal field
		if (selection.kind === graphql.Kind.FIELD) {
			const attributeName = selection.alias?.value || selection.name.value

			// since the id field is used to filter out a mutation, we don't want to register
			// that the mutation will update the id field (it wont)
			if (attributeName === 'id') {
				continue
			}

			if (!mutationTargets[rootType.name].fields[attributeName]) {
				mutationTargets[rootType.name].fields[attributeName] = {}
			}

			// add the field name to the path
			const pathSoFar = path.concat(attributeName)

			// if the field is a scalar type and there is an id field
			if (graphql.isLeafType(type) && useFields) {
				// add the field to the list of things that the mutation can update
				mutationTargets[rootType.name].fields[attributeName][name] = pathSoFar

				// we're done
				continue
			}

			// if the field is points to another type (is an object or list)
			if (selection.selectionSet && (isListType(type) || isObjectType(type))) {
				// walk down the query for more chagnes
				fillMutationMap(
					config,
					mutationTargets,
					name,
					getRootType(type) as graphql.GraphQLObjectType<any, any>,
					selection.selectionSet,
					pathSoFar
				)
			}
		}
	}
}
