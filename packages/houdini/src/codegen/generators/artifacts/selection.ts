import * as graphql from 'graphql'

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

// we're going to generate the selection in two passes. the first will create the various field selections
// and then the second will map the concrete selections onto the abstract ones
export default function (
	args: Omit<Parameters<typeof prepareSelection>[0], 'typeMap' | 'abstractTypes'>
) {
	return mergeSelection({
		config: args.config,
		rootType: args.rootType,
		object: prepareSelection(args),
		filepath: args.filepath,
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
	globalLoading,
	includeFragments,
}: {
	config: Config
	filepath: string
	rootType: string
	selections: readonly graphql.SelectionNode[]
	operations: { [path: string]: MutationOperation[] }
	path?: string[]
	document: Document
	inConnection?: boolean
	globalLoading?: boolean
	includeFragments?: boolean
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
						globalLoading,
						includeFragments,
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
				const typeConditionName = field.typeCondition!.name.value

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
						globalLoading,
						includeFragments,
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
				throw new HoudiniError({
					filepath,
					message: 'Could not find type. Looking for ' + JSON.stringify(rootType),
				})
			}

			const attributeName = field.alias?.value || field.name.value
			let fieldType: graphql.GraphQLType | null = null
			let nullable = false

			// if we are looking at __typename, its a string (not defined in the schema)
			if (field.name.value === '__typename') {
				fieldType = config.schema.getType('String')!
			}
			// if the type is something that has definite fields then we can look up the field
			// type in the schema
			else if ('getFields' in type) {
				let typeRef = type.getFields()[field.name.value].type
				fieldType = getRootType(typeRef)
				nullable = !graphql.isNonNullType(typeRef)
			}
			// if we are looking at an abstract type that doesn't have well-defined fields (ie a union)
			// then we are safe to look at any possible type (i think)
			else if (graphql.isAbstractType(type)) {
				for (const possible of config.schema.getPossibleTypes(type)) {
					if (graphql.isObjectType(possible)) {
						if (possible.getFields()[field.name.value]) {
							fieldType = possible.getFields()[field.name.value].type
							nullable = !graphql.isNonNullType(fieldType)
							break
						}
					}
				}
			}

			// make sure we identified a type
			if (!fieldType) {
				throw {
					message: "Could not identify field's type",
					description: `Missing definition for ${field.name.value} in ${type.name}`,
				}
			}

			const typeName = (getRootType(fieldType) as graphql.GraphQLObjectType).name

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

			const requiredDirective = field.directives?.find(
				(directive) => directive.name.value == config.requiredDirective
			)
			if (requiredDirective) {
				fieldObj.nullable = false
				fieldObj.required = true
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

			// look for a loading directive
			const loadingDirective = field.directives?.find(
				(d) => d.name.value === config.loadingDirective
			)

			// only add the field object if there are properties in it
			if (field.selectionSet) {
				// if this field was marked for cursor based pagination we need to mark
				// the edges field that falls underneath it
				const connectionState =
					(paginated && document.refetch?.method === 'cursor') || continueConnection

				let forceLoading = globalLoading
				if (
					(
						loadingDirective?.arguments?.find(
							(arg) =>
								arg.name.value === 'cascade' && arg.value.kind === 'BooleanValue'
						)?.value as graphql.BooleanValueNode
					)?.value
				) {
					forceLoading = true
				}
				fieldObj.selection = prepareSelection({
					config,
					filepath,
					rootType: typeName,
					selections: field.selectionSet.selections,
					operations,
					path: pathSoFar,
					document,
					inConnection: connectionState,
					// the global loading flag could be enabled for our children if there is a @loading with cascade set to true
					globalLoading: forceLoading,
					includeFragments,
				})

				// bubble nullability up
				if (
					Object.values(fieldObj.selection.fields ?? {}).some((field) => field.required)
				) {
					fieldObj.nullable = true
				}
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
				if (
					Object.values(fieldObj.selection?.abstractFields?.fields ?? {}).some((fields) =>
						Object.values(fields ?? {}).some((field) => field.required)
					)
				) {
					fieldObj.abstractHasRequired = true
				}
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

			// if the fragment spread is marked as a component field we should also register it
			const fieldDirective = field.directives?.find(
				(directive) => directive.name.value === config.componentFieldDirective
			)
			if (fieldDirective) {
				const fieldArg = fieldDirective.arguments?.find((arg) => arg.name.value === 'field')
				const propArg = fieldDirective.arguments?.find((arg) => arg.name.value === 'prop')
				if (
					fieldArg?.value.kind === 'StringValue' &&
					propArg?.value.kind === 'StringValue'
				) {
					const attributeName = fieldArg.value.value
					// add the field data we computed
					object.fields = {
						...object.fields,
						[attributeName]: {
							keyRaw: attributeName,
							type: config.componentScalar,
							component: {
								prop: propArg.value.value,
								key: `${rootType}.${attributeName}`,
								fragment: field.name.value,
							},
						},
					}
				}
			}
		}
	}

	// add the types we're supposed to load as
	if (loadingTypes.length > 0) {
		object.loadingTypes = loadingTypes
	}

	return object
}

function mergeSelection({
	config,
	filepath,
	object,
	rootType,
}: {
	config: Config
	filepath: string
	object: SubscriptionSelection
	rootType: string
}): SubscriptionSelection {
	// the goal here is to make sure there is a single, well defined selection for
	// every type so the runtime doesn't have to do any kind of merges. this means
	// that there shouldn't be any overlap between abstract types.
	if (
		Object.keys(object.fields || {}).length > 0 &&
		object.abstractFields &&
		Object.keys(object.abstractFields.fields).length > 0
	) {
		// the final entry in the abstract selection should have fields that are either
		// concrete types or are abstract type which the parent is mapped to with typeMap
		const abstractSelection: SubscriptionSelection['abstractFields'] = {
			fields: {},
			typeMap: {},
		}

		// as we are looking for overlaps between concrete selections and abstract selections
		// we could run into a single type that falls within multiple abstract types.
		// those types need to have a single entry in the abstract selection that merges them.

		// a mapping from abstract types that are present in the selection
		// to the list of concrete types that implement the abstract type
		const possibleSelectionTypes: Record<string, string[]> = {}
		for (const [typeName, typeSelection] of Object.entries(object.abstractFields.fields)) {
			// grab the type with the matching name from the schema
			const gqlType = config.schema.getType(typeName)

			// concrete types get their selection copied directly
			abstractSelection.fields[typeName] = deepMerge(
				filepath,
				typeSelection,
				abstractSelection.fields[typeName] ?? {}
			)

			// if there is an abstract type then we should collect all of the possible types
			// that could be present in the selection
			if (graphql.isAbstractType(gqlType)) {
				for (const possible of config.schema.getPossibleTypes(gqlType)) {
					if (!possibleSelectionTypes[typeName]) {
						possibleSelectionTypes[typeName] = []
					}

					possibleSelectionTypes[typeName].push(possible.name)
				}
			}
		}

		// we need to build up a map from concrete types to the abstract types they implement
		// so we can look for entries with more than 1 abstract type
		const concreteSelectionImplements: Record<string, string[]> = {}
		for (const [typeName, possibles] of Object.entries(possibleSelectionTypes)) {
			for (const possible of possibles) {
				// add the possible type to our list
				if (!concreteSelectionImplements[possible]) {
					concreteSelectionImplements[possible] = []
				}
				concreteSelectionImplements[possible].push(typeName)
			}
		}

		// if any of the entries have more than 1 abstract type then we need to add an empty
		// entry for the concrete type
		for (const [concrete, implementations] of Object.entries(concreteSelectionImplements)) {
			if (implementations.length > 1) {
				abstractSelection.fields[concrete] = {}
			}
		}

		// if the possible type has already been included as an explicit selection
		// then we need to add the abstract types selection to the concrete one
		for (const [typeName, possibles] of Object.entries(possibleSelectionTypes)) {
			for (const possible of possibles) {
				if (abstractSelection.fields[possible]) {
					abstractSelection.fields[possible] = deepMerge(
						filepath,
						abstractSelection.fields[typeName] ?? {},
						abstractSelection.fields[possible] ?? {}
					)
				}
			}
		}

		// now that we have the final type map, we don't need to include any entries
		// that are not possible given the parent type
		const parentType = config.schema.getType(rootType)
		const possibleParents = graphql.isAbstractType(parentType)
			? config.schema.getPossibleTypes(parentType)?.map((t) => t.name)
			: [parentType!.name]
		for (const key of Object.keys(abstractSelection.typeMap)) {
			if (
				(!possibleParents.includes(key) && rootType !== key) ||
				abstractSelection.fields[key]
			) {
				delete abstractSelection.typeMap[key]
			}
		}

		// make sure that every abstract type is also processing the concrete selection
		for (const [type, sel] of Object.entries(abstractSelection.fields || {})) {
			abstractSelection.fields[type] = deepMerge(filepath, sel || {}, object.fields!)
		}

		// if every possible type of an abstract selection is present then we can remove
		// the abstract entry
		for (const [typename, possibles] of Object.entries(possibleSelectionTypes)) {
			if (possibles.every((p) => abstractSelection.fields[p])) {
				delete abstractSelection.fields[typename]
			}
		}

		// the type map defines how we go from each of the possible parent types
		// to the actual selection the user specified
		for (const possible of possibleParents) {
			// if the type is present in the abstract selection, we need to ignore it
			if (abstractSelection.fields[possible]) {
				continue
			}

			// if there is a type that falls into multiple abstract selections
			// then it was pulled out into an explicit entry with the merge
			// this means that if a possible type is not directly present in the selection
			// it must be a type that implements only one of the abstract types in the selection
			//
			// TODO: THIS IS WAY TOO COMPLICATED. FIGURE SOMETHING ELSE OUT
			// all we need to do is hunt down the first abstract type that this type implements
			for (const [abstractType, abstractTypeMembers] of Object.entries(
				possibleSelectionTypes
			)) {
				if (abstractTypeMembers.includes(possible)) {
					abstractSelection.typeMap[possible] = abstractType
					break
				}
			}
		}

		// use the cleaned up selection
		object.abstractFields = abstractSelection
	}

	// now that we've cleaned up this local node, we need to walk down and do the same
	for (const value of Object.values(object.fields ?? {})) {
		const selection = value.selection
		if (selection) {
			mergeSelection({
				config,
				rootType: value.type,
				filepath,
				object: selection,
			})
		}
	}

	// and walk down the abstract selections too
	for (const [type, selection] of Object.entries(object.abstractFields?.fields ?? {})) {
		for (const value of Object.values(selection ?? {})) {
			const selection = value.selection
			if (selection) {
				mergeSelection({
					config,
					rootType: value.type,
					filepath,
					object: selection,
				})
			}
		}
	}

	// we're done
	return object
}
