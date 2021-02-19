// externals
import { Config, isListType, isObjectType, getRootType, selectionTypeInfo } from 'houdini-common'
import * as graphql from 'graphql'
import fs from 'fs/promises'
// locals
import { CollectedGraphQLDocument, ConnectionWhenGeneric } from '../../types'
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
					kind: PatchAtom['operation']
					position: 'start' | 'end'
					when: { [key: string]: string }
					parentID: {
						kind: 'Variable' | 'String' | 'Root'
						value: string
					}
					path: string[]
					connectionName: string
				}
			}
		}
	}
}

// another intermediate type used when building up the mutation description
export type PatchAtom = {
	operation: 'add' | 'remove' | 'update' | 'delete'
	mutationName: string
	mutationPath: string[]
	queryName: string
	queryPath: string[]
	// connection fields
	parentID?: {
		kind: 'Variable' | 'String' | 'Root'
		value: string
	}
	when?: ConnectionWhenGeneric
	connectionName?: string
	position?: 'start' | 'end'
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

		if (
			definition.kind === graphql.Kind.FRAGMENT_DEFINITION &&
			config.isConnectionFragment(definition.name.value)
		) {
			continue
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

				// make sure we have an entry in the mutation map
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

				// figure out the operation
				let operation: PatchAtom['operation']
				if (config.isInsertFragment(selection.name.value)) {
					operation = 'add'
				} else if (config.isRemoveFragment(selection.name.value)) {
					operation = 'remove'
				} else {
					throw new HoudiniErrorTodo(
						'Could not identify connection operation: ' + selection.name.value
					)
				}

				// look at the directives applies to the spread for meta data about the mutation
				let parentID = 'root'
				let parentKind: 'Root' | 'Variable' | 'String' = 'Root'

				let insertLocation: MutationMap[string]['operations'][string][string]['position'] =
					'end'

				let when: { [key: string]: string } = {}

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

					// the parent ID can be provided a few ways, either as an argument to the prepend
					// and append directives or with the parentID directive.

					// look for the parentID directive
					let parentDirective = internalDirectives.find(
						({ name }) => name.value === config.connectionParentDirective
					)
					let parentIDArg = parentDirective?.arguments?.find(
						(argument) => argument.name.value === 'value'
					)
					// if there is no parent id argument, it could have been provided by one of the connection directives
					if (!parentIDArg) {
						parentIDArg = (append || prepend)?.arguments?.find(
							({ name }) => name.value === config.connectionDirectiveParentIDArg
						)
					}

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

					// look for a when condition on the operation
					const whenArg = (append || prepend)?.arguments?.find(
						({ name }) => name.value === 'when'
					)
					if (whenArg && whenArg.value.kind === 'ObjectValue') {
						// build up all of the values into a single object
						const key = whenArg.value.fields.find(
							({ name, value }) => name.value === 'argument'
						)?.value
						const value = whenArg.value.fields.find(
							({ name }) => name.value === 'value'
						)

						// make sure we got a string for the key
						if (
							key?.kind !== 'StringValue' ||
							!value ||
							value.value.kind !== 'StringValue'
						) {
							throw new Error('Key and Value must be strings')
						}

						// the kind of `value` is always going to be a string because the directive
						// can only take one type as its argument so we have to go look at the
						// field definition in the schema for type information to cast the value
						// to something useful for the rest of the world
						when[key.value] = value.value.value
					}
				}

				// we need to add an operation to the list for this open
				mutationTargets[rootType.name].operations[selection.name.value][mutationName] = {
					parentID: {
						kind: parentKind,
						value: parentID,
					},
					position: insertLocation,
					kind: operation,
					path,
					when,
					connectionName: config.connectionNameFromFragment(selection.name.value),
				}
			}

			continue
		}

		// process inline fragments
		if (selection.kind === graphql.Kind.INLINE_FRAGMENT) {
			continue
		}

		// look up the type of the selection
		const { field, type } = selectionTypeInfo(config.schema, rootType, selection)

		// if we are looking at a normal field
		if (selection.kind === graphql.Kind.FIELD) {
			const attributeName = selection.alias?.value || selection.name.value

			// the field might be tagged with a delete directive
			const deleteDirective = selection.directives?.find(({ name }) =>
				config.isDeleteDirective(name.value)
			)
			if (deleteDirective) {
				// the target of the delete is the type identified by the directive name
				const deleteTarget = config.deleteDirectiveType(deleteDirective.name.value)
				// there is no specific connection for a delete operation
				const connectionName = `__houdini__delete_${deleteTarget}_${name}`

				// the delete directive gets attached to the target field
				if (!mutationTargets[deleteTarget]) {
					mutationTargets[deleteTarget] = {
						operations: {},
						fields: {},
					}
				}
				// if we haven't registered an operation here before, do so
				if (!mutationTargets[deleteTarget].operations[connectionName]) {
					mutationTargets[deleteTarget].operations[connectionName] = {}
				}

				// add the delete operation to the patch list
				mutationTargets[deleteTarget].operations[connectionName][name] = {
					parentID: {
						kind: 'Root',
						value: 'root',
					},
					position: 'end',
					kind: 'delete',
					path: path.concat(attributeName),
					when: {},
					connectionName: config.connectionNameFromFragment(connectionName),
				}
			}

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
