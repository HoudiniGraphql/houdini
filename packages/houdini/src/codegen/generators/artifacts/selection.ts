import * as graphql from 'graphql'
import * as recast from 'recast'

import type { Config, Document } from '../../../lib'
import { TypeWrapper, unwrapType, deepMerge, getRootType, HoudiniError } from '../../../lib'
import {
	RefetchUpdateMode,
	type MutationOperation,
	type SubscriptionSelection,
	type LoadingSpec,
} from '../../../runtime/lib/types'
import { connectionSelection } from '../../transforms/list'
import fieldKey from './fieldKey'
import { convertValue } from './utils'

const AST = recast.types.builders

// we're going to generate the selection in two passes. the first will create the various field selections
// and then the second will map the concrete selections onto the abstract ones
export default function (
	args: Omit<Parameters<typeof prepareSelection>[0], 'typeMap' | 'abstractTypes'>
) {
	const typeMap: Record<string, string[]> = {}
	const abstractTypes: string[] = []
	return mergeSelection({
		object: prepareSelection({ ...args, typeMap, abstractTypes }),
		filepath: args.filepath,
		typeMap,
		abstractTypes,
	})
}

function prepareSelection({
	config,
	filepath,
	rootType,
	selections,
	operations,
	path = [],
	document,
	inConnection,
	typeMap,
	abstractTypes,
	globalLoading,
}: {
	config: Config
	filepath: string
	rootType: string
	selections: readonly graphql.SelectionNode[]
	operations: { [path: string]: MutationOperation[] }
	path?: string[]
	document: Document
	inConnection?: boolean
	typeMap: Record<string, string[]>
	abstractTypes: string[]
	globalLoading?: boolean
}): SubscriptionSelection {
	// we need to build up an object that contains every field in the selection
	let object: SubscriptionSelection = {}

	// if we run into an inline fragment with the loading directive we want
	// to consider it a loading type
	const loadingTypes: string[] = []

	for (const field of selections) {
		// inline fragments should be merged with the parent
		if (field.kind === 'InlineFragment') {
			// if the type condition doesn't exist or matches the parent type,
			// just merge it
			if (!field.typeCondition || field.typeCondition.name.value === rootType) {
				// we need to deep merge to remove the inline fragment
				object.fields = deepMerge(
					filepath,
					object.fields || {},
					prepareSelection({
						config,
						filepath,
						rootType: field.typeCondition?.name.value || rootType,
						operations,
						selections: field.selectionSet.selections,
						path,
						document,
						typeMap,
						abstractTypes,
						globalLoading,
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
						const existing = typeMap[type]
						if (!existing || !existing.includes(type)) {
							typeMap[type] = [typeConditionName].concat(existing || [])
						}
						if (!abstractTypes.includes(typeConditionName)) {
							abstractTypes.push(typeConditionName)
						}
					}
				}

				// add the type specific selection to the abstract collection so the runtime
				// can compare its concrete __typename
				object.abstractFields.fields = {
					...object.abstractFields.fields,
					[typeConditionName]: prepareSelection({
						config,
						filepath,
						rootType: typeConditionName || rootType,
						operations,
						selections: field.selectionSet.selections,
						path,
						document,
						typeMap,
						abstractTypes,
						globalLoading,
					}).fields,
				}

				// look for the loading directive
				if (field.directives?.find((d) => d.name.value === config.loadingDirective)) {
					loadingTypes.push(typeConditionName)
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

			const keys = config.keyFieldsForType(rootType)

			// the object holding data for this field
			let fieldObj: Required<SubscriptionSelection>['fields']['field'] = {
				type: typeName,
				keyRaw: fieldKey(config, field),
			}

			// add directive meta data
			if (field.directives && field.directives.length > 0) {
				fieldObj.directives = field.directives?.map((directive) => ({
					name: directive.name.value,
					arguments: (directive.arguments ?? []).reduce(
						(acc, arg) => ({
							...acc,
							[arg.name.value]: config.serializeValueMap({ field: arg.value })![
								'field'
							],
						}),
						{}
					),
				}))
			}

			if (keys.includes(field.name.value)) {
				fieldObj.visible = true
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
			const nameArg = listDirective?.arguments?.find(
				(arg) => arg.name.value === config.listOrPaginateNameArg
			)
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

			// if the field is marked for offset pagination
			if (paginated && document.refetch && document.refetch.method === 'offset') {
				// we need to mark this field as only accepting append updates
				fieldObj.updates = [RefetchUpdateMode.append]
			}

			let continueConnection = inConnection
			// if we are looking at the edges field and we're supposed to mark it for pagination
			if (
				[
					'edges',
					// we want to include the page info fields here so that they are considered special
					// when we apply a particular update as part of cursor pagination
					'endCursor',
					'startCursor',
					'hasNextPage',
					'hasPreviousPage',
				].includes(attributeName) &&
				inConnection &&
				document.refetch
			) {
				// otherwise mark this field
				fieldObj.updates = [RefetchUpdateMode.append, RefetchUpdateMode.prepend]
			}
			if (attributeName === 'node' && inConnection) {
				continueConnection = false
			}

			// only add the field object if there are properties in it
			if (field.selectionSet) {
				// if this field was marked for cursor based pagination we need to mark
				// the edges field that falls underneath it
				const connectionState =
					(paginated && document.refetch?.method === 'cursor') || continueConnection

				fieldObj.selection = prepareSelection({
					config,
					filepath,
					rootType: typeName,
					selections: field.selectionSet.selections,
					operations,
					path: pathSoFar,
					document,
					inConnection: connectionState,
					typeMap,
					abstractTypes,
					globalLoading,
				})
			}

			// any arguments on the list field can act as a filter
			if (field.arguments?.length && fieldObj.list) {
				fieldObj.filters = (field.arguments || []).reduce(
					(filters, arg) => ({
						...filters,
						[arg.name.value]: convertValue(config, arg.value),
					}),
					{}
				)
			}

			// if we have a loading directive present on the field then we need to
			// encode the correct behavior
			const loadingDirective = field.directives?.find(
				(d) => d.name.value === config.loadingDirective
			)
			if (globalLoading || loadingDirective) {
				// the value we assign depends on wether this is the deepest
				// selection in this branch with @loading
				// NOTE: this logic is copied and pasted in the index.js for the artifact loading state
				const childFields = Object.values(fieldObj.selection?.fields ?? {}).concat(
					Object.values(fieldObj.selection?.abstractFields?.fields ?? {}).flatMap(
						(fieldMap) => Object.values(fieldMap ?? {})
					)
				)
				const loadingFragments =
					Object.values(fieldObj.selection?.fragments ?? {}).length > 0 &&
					Object.values(fieldObj.selection?.fragments ?? {}).some((f) => f.loading)
				let deepestChild = !childFields.some((field) => field.loading) && !loadingFragments
				const loadingValue: LoadingSpec = deepestChild
					? {
							kind: 'value',
					  }
					: { kind: 'continue' }

				// look up the type of the field so we can wrap it up in lists if necessary
				const parentType = config.schema.getType(rootType)!
				if (graphql.isObjectType(parentType) || graphql.isInterfaceType(parentType)) {
					const fieldType = parentType.getFields()[field.name.value]?.type
					if (fieldType) {
						// if we are wrapped in a list, we need to embed the necessary data
						const listCount = unwrapType(config, fieldType).wrappers.filter(
							(w) => w === TypeWrapper.List
						).length
						if (listCount > 0) {
							// look for the count arg
							const countArg = loadingDirective?.arguments?.find(
								(arg) => arg.name.value === 'count'
							)
							let countValue = 3
							if (countArg?.value.kind === 'IntValue') {
								countValue = parseInt(countArg.value.value)
							}

							loadingValue.list = {
								depth: listCount,
								count: countValue,
							}
						}
					}
				}

				fieldObj.loading = loadingValue
			}

			// if we are looking at an interface
			if (graphql.isInterfaceType(fieldType) || graphql.isUnionType(fieldType)) {
				fieldObj.abstract = true
			}

			// if there is an existing value, merge them
			if (object.fields?.[attributeName]) {
				fieldObj = deepMerge(filepath, object.fields[attributeName], fieldObj)
			}

			// add the field data we computed
			object.fields = {
				...object.fields,
				[attributeName]: fieldObj,
			}
		}
		// fragment spreads need to be added to the object
		else if (field.kind === 'FragmentSpread') {
			const { fragment, args } = config.getFragmentVariablesHash(field.name.value)
			object.fragments = {
				...object.fragments,
				[fragment]: {
					arguments: args ?? {},
				},
			}

			// assign the loading state if necessary
			if (
				globalLoading ||
				field.directives?.find((d) => d.name.value === config.loadingDirective)
			) {
				object.fragments[fragment].loading = true
			}
		}
	}

	// add the types we're supposed to load as
	if (loadingTypes.length > 1) {
		throw {
			filepath,
			message: `@${config.loadingDirective} can only be on one branch of an abstract selection.`,
		}
	} else if (loadingTypes.length === 1) {
		object.loadingTypes = loadingTypes
	}

	return object
}

function mergeSelection({
	filepath,
	object,
	typeMap,
	abstractTypes,
}: {
	filepath: string
	object: SubscriptionSelection
	typeMap: Record<string, string[]>
	abstractTypes: string[]
}): SubscriptionSelection {
	// we need to visit every selection in the artifact and
	// make sure that concrete values are always applied on the
	// abstract selections
	if (
		Object.keys(object.fields || {}).length > 0 &&
		object.abstractFields &&
		Object.keys(object.abstractFields.fields).length > 0
	) {
		// the goal here is to make sure there is a single, well defined selection for
		// every type so the runtime doesn't have to do any kind of merges. this means
		// that there shouldn't be any overlap between abstract types.

		// if there _is_ overlap, we need to merge them so there's only one selection
		// to walk down
		for (const [typeName, possibles] of Object.entries(typeMap)) {
			// if there is an overlap, we want to delete the entry in the typemap
			let overlap = false

			// if the typeName in the map also has its own abstract selection then
			// we need to merge every mapped type into the abstract selection
			for (const possible of possibles) {
				if (object.abstractFields.fields[typeName]) {
					object.abstractFields!.fields[typeName] = deepMerge(
						filepath,
						object.abstractFields.fields[typeName] ?? {},
						object.abstractFields.fields[possible] ?? {}
					)

					// there was in fact overlap between the mapped type and another abstract selection
					overlap = true
				}
			}

			// delete the overlapping key if there was overlap
			if (overlap) {
				delete typeMap[typeName]
			}
		}

		// if there is more than one selection for the concrete type, and we got this far,
		// we need to create a new entry in the abstract selection that merges them together
		for (const [type, options] of Object.entries(typeMap)) {
			if (options.length > 1) {
				object.abstractFields!.fields[type] = deepMerge(
					filepath,
					...options.map((opt) => object.abstractFields!.fields[opt] || {})
				)

				delete typeMap[type]
			}
		}
		// make sure that every abstract type is also processing the concrete selection
		for (const [type, sel] of Object.entries(object.abstractFields?.fields || {})) {
			object.abstractFields!.fields[type] = deepMerge(filepath, sel || {}, object.fields!)
		}

		// if we got this far, the typeMap should only have elements pointing to lists of one
		for (const [type, options] of Object.entries(typeMap)) {
			object.abstractFields.typeMap[type] = options[0]
		}

		// clean up the abstract types that got merged away
		const usedTypes = Object.values(object.abstractFields.typeMap)
		for (const type of abstractTypes) {
			// if there is no entry in the type map for them, it can be delete
			if (!usedTypes.includes(type)) {
				delete object.abstractFields.fields[type]
			}
		}
	}

	// now that we've cleaned up this local node, we need to walk down and do the same
	for (const [key, value] of Object.entries(object.fields ?? {})) {
		const selection = value.selection
		if (selection) {
			mergeSelection({
				filepath,
				typeMap,
				abstractTypes,
				object: selection,
			})
		}
	}

	// and walk down the abstract selections too
	for (const [type, selection] of Object.entries(object.abstractFields?.fields ?? {})) {
		for (const [key, value] of Object.entries(selection ?? {})) {
			const selection = value.selection
			if (selection) {
				mergeSelection({
					filepath,
					typeMap,
					abstractTypes,
					object: selection,
				})
			}
		}
	}

	// we're done
	return object
}
