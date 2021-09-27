// externals
import { Config, getRootType } from 'houdini-common'
import * as graphql from 'graphql'
import * as recast from 'recast'
// locals
import fieldKey from './fieldKey'
import { CollectedGraphQLDocument } from '../../types'
import type { MutationOperation, SubscriptionSelection } from '../../../runtime'
import { convertValue, deepMerge } from './utils'
import { connectionSelection } from '../../transforms/list'

const AST = recast.types.builders

// USE FLATTENED SELECTION here to avoid deep merge

export default function selection({
	config,
	rootType,
	selectionSet,
	operations,
	path = [],
	includeFragments,
	document,
	markEdges,
}: {
	config: Config
	rootType: string
	selectionSet: graphql.SelectionSetNode
	operations: { [path: string]: MutationOperation[] }
	path?: string[]
	includeFragments: boolean
	document: CollectedGraphQLDocument
	markEdges?: string
}): SubscriptionSelection {
	// we need to build up an object that contains every field in the selection
	let object: SubscriptionSelection = {}

	for (const field of selectionSet.selections) {
		// ignore fragment spreads
		if (field.kind === 'FragmentSpread' && includeFragments) {
			// look up the fragment definition
			const fragmentDefinition = document.document.definitions.find(
				(defn) => defn.kind === 'FragmentDefinition' && defn.name.value === field.name.value
			) as graphql.FragmentDefinitionNode
			if (!fragmentDefinition) {
				throw new Error('Could not find definition for fragment ' + field.name.value)
			}

			// merge the fragments selection into ours
			object = deepMerge(
				object,
				selection({
					config,
					rootType: fragmentDefinition.typeCondition.name.value,
					operations,
					selectionSet: fragmentDefinition.selectionSet,
					path,
					includeFragments,
					document,
				})
			)
		}
		// inline fragments should be merged with the parent
		else if (field.kind === 'InlineFragment') {
			object = deepMerge(
				object,
				selection({
					config,
					rootType: field.typeCondition?.name.value || rootType,
					operations,
					selectionSet: field.selectionSet,
					path,
					includeFragments,
					document,
				})
			)
		}
		// fields need their own entry
		else if (field.kind === 'Field') {
			// look up the field
			const type = config.schema.getType(rootType) as graphql.GraphQLObjectType
			if (!type) {
				throw new Error('Could not find type')
			}

			const attributeName = field.alias?.value || field.name.value
			// if we are looking at __typename, its a string (not defined in the schema)
			let fieldType: graphql.GraphQLType
			if (field.name.value === '__typename') {
				fieldType = config.schema.getType('String')!
			} else {
				fieldType = getRootType(type.getFields()[field.name.value].type)
			}
			const typeName = fieldType.toString()

			// make sure we include the attribute in the path
			const pathSoFar = path.concat(attributeName)

			// the object holding data for this field
			const fieldObj: SubscriptionSelection['field'] = {
				type: typeName,
				keyRaw: fieldKey(config, field),
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

				fieldObj.fields = selection({
					config,
					rootType: typeName,
					selectionSet: field.selectionSet,
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
			object[attributeName] = deepMerge(
				fieldObj,
				object[attributeName] || {}
			) as SubscriptionSelection['field']
		}
	}

	return object
}
