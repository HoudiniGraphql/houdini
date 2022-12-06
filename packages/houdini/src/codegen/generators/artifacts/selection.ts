import * as graphql from 'graphql'

import { Config, getRootType, HoudiniError, CollectedGraphQLDocument } from '../../../lib'
import type { MutationOperation, SubscriptionSelection } from '../../../runtime/lib/types'
import { connectionSelection } from '../../transforms/list'
import fieldKey from './fieldKey'
import { convertValue, deepMerge } from './utils'

export default function selection({
	config,
	filepath,
	rootType,
	selections,
	operations,
	path = [],
	includeFragments,
	document,
	markEdges,
}: {
	config: Config
	filepath: string
	rootType: string
	selections: readonly graphql.SelectionNode[]
	operations: { [path: string]: MutationOperation[] }
	path?: string[]
	includeFragments: boolean
	document: CollectedGraphQLDocument
	markEdges?: string
}): SubscriptionSelection {
	// we need to build up an object that contains every field in the selection
	let object: SubscriptionSelection = {}

	for (const field of selections) {
		// ignore fragment spreads
		if (field.kind === 'FragmentSpread' && includeFragments) {
			// look up the fragment definition
			const fragmentDefinition = document.document.definitions.find(
				(defn) => defn.kind === 'FragmentDefinition' && defn.name.value === field.name.value
			) as graphql.FragmentDefinitionNode
			if (!fragmentDefinition) {
				throw new HoudiniError({
					filepath,
					message:
						'selection: could not find definition for fragment ' + field.name.value,
				})
			}

			// merge the fragments selection into ours
			object = deepMerge(
				filepath,
				object,
				selection({
					config,
					filepath,
					rootType: fragmentDefinition.typeCondition.name.value,
					operations,
					selections: fragmentDefinition.selectionSet.selections,
					path,
					includeFragments,
					document,
				})
			)
		}
		// inline fragments should be merged with the parent
		else if (field.kind === 'InlineFragment') {
			// if the type condition doesn't exist or matches the parent type,
			// just merge it
			if (!field.typeCondition || field.typeCondition.name.value === rootType) {
				// we need to deep merge to remove the inline fragment
				object.fields = deepMerge(
					filepath,
					object.fields || {},
					selection({
						config,
						filepath,
						rootType: field.typeCondition?.name.value || rootType,
						operations,
						selections: field.selectionSet.selections,
						path,
						includeFragments,
						document,
					}).fields || {}
				)
			}
			// we have an inline fragment that changes the type, in order to support unions/interfaces
			// we need to embed the field in a type-dependent way
			else {
				if (!object.abstractFields) {
					object.abstractFields = {
						fields: {},
						typeMap: {},
					}
				}

				// in order to map the concrete __typename to the inline fragment
				// we need to look for the intersection between the parent type and the
				// type condition on the fragment
				const parentType = config.schema.getType(rootType)!
				const typeConditionName = field.typeCondition!.name.value
				const typeCondition = config.schema.getType(typeConditionName)!

				// build up the list of types that we need to map to the typecondition's abstract selection
				const possibleTypes: string[] = []

				// if the type condition is not an interface or union then there's no need to map
				// to an abstract type. The __typename will always match
				if (!graphql.isAbstractType(typeCondition)) {
					// don't do anything
				}
				// if the both the parent type and the type condition are abstract, we need to
				// compute the intersection to map the concrete __typename to
				else if (graphql.isAbstractType(parentType)) {
					// get the possible types that the parent could be
					const possibleParentTypes = config.schema
						.getPossibleTypes(parentType)
						.map((type) => type.name)

					// we need to make sure that every possible match has an entry in the typeMap
					// that maps the concrete __typename to the abstract selection
					for (const possible of config.schema.getPossibleTypes(typeCondition)) {
						if (possibleParentTypes.includes(possible.name)) {
							possibleTypes.push(possible.name)
						}
					}
				}
				// the parent type is always an instance of the type condition so we don't need to do
				// anything fancy. just add an entry in the type map that points the parent to the
				// abstract version
				else {
					possibleTypes.push(rootType)
				}

				// if we have to map parent type to abstract selection
				if (possibleTypes.length > 0) {
					for (const type of possibleTypes) {
						const existing = object.abstractFields.typeMap[rootType]
						if (!existing || !existing.includes(type)) {
							console.log(existing)
							object.abstractFields.typeMap[type] = [typeConditionName].concat(
								existing || []
							)
						}
					}
				}

				// add the type specific selection to the abstract collection so the runtime
				// can compare its concrete __typename
				object.abstractFields.fields = {
					...object.abstractFields.fields,
					[field.typeCondition.name.value]: selection({
						config,
						filepath,
						rootType: field.typeCondition?.name.value || rootType,
						operations,
						selections: field.selectionSet.selections,
						path,
						includeFragments,
						document,
					}).fields,
				}
			}
		}
		// fields need their own entry
		else if (field.kind === 'Field') {
			// look up the field
			const type = config.schema.getType(rootType) as graphql.GraphQLObjectType
			if (!type) {
				throw new HoudiniError({ filepath, message: 'Could not find type' })
			}

			const attributeName = field.alias?.value || field.name.value
			// if we are looking at __typename, its a string (not defined in the schema)
			let fieldType: graphql.GraphQLType
			let nullable = false
			if (field.name.value === '__typename') {
				fieldType = config.schema.getType('String')!
			} else {
				let typeRef = type.getFields()[field.name.value].type
				fieldType = getRootType(typeRef)
				nullable = !graphql.isNonNullType(typeRef)
			}
			const typeName = fieldType.toString()

			// make sure we include the attribute in the path
			const pathSoFar = path.concat(attributeName)

			// the object holding data for this field
			const fieldObj: Required<SubscriptionSelection>['fields']['field'] = {
				type: typeName,
				keyRaw: fieldKey(config, field),
			}

			if (nullable) {
				fieldObj.nullable = true
			}

			// is there an operation for this field
			const operationKey = pathSoFar.join(',')
			if (operations[operationKey]) {
				fieldObj.operations = operations[operationKey]
			}

			// get the name of the list directive tagging this field
			const listDirective = field.directives?.find((directive) =>
				[config.listDirective, config.paginateDirective].includes(directive.name.value)
			)
			const nameArg = listDirective?.arguments?.find((arg) => arg.name.value === 'name')
			if (nameArg && nameArg.value.kind === 'StringValue') {
				const { connection, type: connectionType } = connectionSelection(
					config,
					type.getFields()[field.name.value] as graphql.GraphQLField<any, any>,
					fieldType as graphql.GraphQLObjectType,
					field.selectionSet
				)

				fieldObj.list = {
					name: nameArg.value.value,
					connection,
					type: connectionType.name,
				}
			}

			// if the field is marked for pagination we want to leave something behind
			// so that cache.write can perform the necessary inserts when appropriate
			const paginated = field.directives?.find(
				(directive) => directive.name.value === config.paginateDirective
			)

			// if the field is marked for offset pagination we need to mark this field
			if (paginated && document.refetch && document.refetch.method === 'offset') {
				fieldObj.update = document.refetch.update
			}

			// if we are looking at the edges field and we're supposed to mark it for pagination
			if (attributeName === 'edges' && markEdges && document.refetch) {
				// otherwise mark this field
				fieldObj.update = document.refetch.update

				// make sure we don't mark the children
				markEdges = ''
			}

			// only add the field object if there are properties in it
			if (field.selectionSet) {
				// if this field was marked for cursor based pagination we need to mark
				// the edges field that falls underneath it
				const edgesMark =
					paginated && document.refetch?.method === 'cursor'
						? document.refetch.update
						: markEdges

				fieldObj.selection = selection({
					config,
					filepath,
					rootType: typeName,
					selections: field.selectionSet.selections,
					operations,
					path: pathSoFar,
					includeFragments,
					document,
					markEdges: edgesMark,
				})
			}

			// any arguments on the list field can act as a filter
			if (field.arguments?.length && fieldObj.list) {
				fieldObj.filters = (field.arguments || []).reduce(
					(filters, arg) => ({
						...filters,
						[arg.name.value]: convertValue(arg.value),
					}),
					{}
				)
			}

			// if we are looking at an interface
			if (graphql.isInterfaceType(fieldType) || graphql.isUnionType(fieldType)) {
				fieldObj.abstract = true
			}

			// add the field data we computed
			object.fields = {
				...object.fields,
				[attributeName]: fieldObj,
			}
		}
	}

	// if the field has fields and abstract fields, we need to merge them
	if (
		Object.keys(object.fields || {}).length > 0 &&
		Object.keys(object.abstractFields || {}).length > 0
	) {
		// merge the fields into the abstract  fields
		for (const [type, sel] of Object.entries(object.abstractFields?.fields || {})) {
			object.abstractFields!.fields[type] = deepMerge(filepath, sel || {}, object.fields!)
		}
	}

	return object
}
