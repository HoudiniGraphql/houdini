import type { TSTypeKind, StatementKind } from 'ast-types/gen/kinds'
import * as graphql from 'graphql'
import * as recast from 'recast'

import { Config, ensureImports, HoudiniError } from '../../../lib'
import { TypeWrapper, unwrapType } from '../../utils'
import { nullableField, readonlyProperty, scalarPropertyValue } from './types'

const AST = recast.types.builders

export const fragmentKey = '$fragments'

export function inlineType({
	config,
	filepath,
	rootType,
	selections,
	root,
	allowReadonly,
	body,
	visitedTypes,
	missingScalars,
	includeFragments,
	allOptional,
}: {
	config: Config
	filepath: string
	rootType: graphql.GraphQLNamedType
	selections: readonly graphql.SelectionNode[] | undefined
	root: boolean
	allowReadonly: boolean
	body: StatementKind[]
	visitedTypes: Set<string>
	missingScalars: Set<string>
	includeFragments: boolean
	allOptional?: boolean
}): TSTypeKind {
	// start unwrapping non-nulls and lists (we'll wrap it back up before we return)
	const { type, wrappers } = unwrapType(config, rootType)

	let result: TSTypeKind
	// if we are looking at a scalar field
	if (graphql.isScalarType(type)) {
		result = scalarPropertyValue(config, missingScalars, type as graphql.GraphQLNamedType)
	}
	// we could have encountered an enum
	else if (graphql.isEnumType(type)) {
		// have we seen the enum before
		if (!visitedTypes.has(type.name)) {
			ensureImports({
				config,
				// @ts-ignore
				body,
				import: [type.name],
				sourceModule: '$houdini/graphql/enums',
			})

			// register that we've visited the type already
			visitedTypes.add(type.name)
		}

		result = AST.tsTypeReference(AST.identifier(type.name))
	}
	// if we are looking at something with a selection set
	else if (selections) {
		const rootObj = type as graphql.GraphQLObjectType<any, any>

		// a selection can contain 1 of 3 things:
		// - a field
		// - an inline fragment
		// - a fragment spread

		// an inline fragment can refer to an interface that's not referred in another
		// fragment so we need to break down all fragments into their concrete versions
		// discriminated by __typename

		// before we can begin, we need to sort the selection set for this field for
		// fields defined on the interface as well as subtypes of the interface
		const inlineFragments: { [typeName: string]: graphql.SelectionNode[] } = {}
		// the rest of the selection can be a single type in the union
		const selectedFields: graphql.SelectionNode[] = []

		for (const selection of selections) {
			// if we found an inline fragment then we have a sub-condition on the fragment
			if (selection.kind === 'InlineFragment' && selection.typeCondition) {
				// the type of the fragment
				const fragmentType = config.schema.getType(selection.typeCondition.name.value)!

				// if the parent is a non-union or interface then the __typename is only going to have a single
				// value so we just need to add every field to the list
				if (!graphql.isInterfaceType(type) && !graphql.isUnionType(type)) {
					selectedFields.push(...selection.selectionSet.selections)
					continue
				}

				// the parent type is not concrete so the selections will have to be organized
				// into discriminated and non discriminated parts

				// if the fragment type is not an interface or union, we should just
				// add the selection as part of the discriminated selection
				if (!graphql.isInterfaceType(fragmentType) && !graphql.isUnionType(fragmentType)) {
					// make sure we have to place to put the discriminated type
					if (!inlineFragments[fragmentType.name]) {
						inlineFragments[fragmentType.name] = []
					}

					inlineFragments[fragmentType.name].push(...selection.selectionSet.selections)

					// we're done processing this type
					continue
				}

				const possibleParents = config.schema.getPossibleTypes(type).map((t) => t.name)

				// the fragment type is an interface or union and is getting mixed into an interface or union
				// which means every possible type of fragment type needs to be mixed into the discriminated
				// portion for the particular type
				for (const possibleType of config.schema.getPossibleTypes(fragmentType)) {
					// if the possible type is not a possible type of the parent, the intersection isn't possible
					if (!possibleParents.includes(possibleType.name)) {
						continue
					}

					// make sure we have to place to put the discriminated type
					if (!inlineFragments[possibleType.name]) {
						inlineFragments[possibleType.name] = []
					}

					// add the selection to the discriminated object of the intersecting type
					inlineFragments[possibleType.name].push(...selection.selectionSet.selections)
				}
			}
			// an inline fragment without a selection is just a fancy way of asking for fields
			else if (selection.kind === 'InlineFragment' && !selection.typeCondition) {
				selectedFields.push(...selection.selectionSet.selections)
			}
			// the selection is just a normal field, add it to the non-discriminated object
			else {
				selectedFields.push(selection)
			}
		}

		// turn the set of selected fields into their own type
		result = AST.tsTypeLiteral([
			// every field gets an entry in the object
			...(
				(selectedFields || []).filter(
					(field) => field.kind === 'Field'
				) as graphql.FieldNode[]
			).map((selection) => {
				// grab the type info for the selection
				const { type, field } = selectionTypeInfo(
					config.schema,
					filepath,
					rootObj,
					selection
				)

				// figure out the response name
				const attributeName = selection.alias?.value || selection.name.value

				// figure out the corresponding typescript type
				let attributeType = inlineType({
					config,
					filepath,
					rootType: field.type as graphql.GraphQLNamedType,
					selections: selection.selectionSet?.selections as graphql.SelectionNode[],
					root: false,
					allowReadonly,
					visitedTypes,
					body,
					missingScalars,
					includeFragments,
					allOptional,
				})

				// we're done
				const prop = readonlyProperty(
					AST.tsPropertySignature(
						AST.identifier(attributeName),
						AST.tsTypeAnnotation(attributeType)
					),
					allowReadonly
				)

				if (allOptional) {
					prop.optional = true
				}

				return prop
			}),
		])

		// embed any referenced fragments in the result
		const fragmentSpreads = selections?.filter(({ kind }) => kind === 'FragmentSpread') as
			| graphql.FragmentSpreadNode[]
			| undefined

		if (includeFragments && fragmentSpreads && fragmentSpreads.length) {
			result.members.push(
				readonlyProperty(
					AST.tsPropertySignature(
						AST.identifier(fragmentKey),
						AST.tsTypeAnnotation(
							AST.tsTypeLiteral(
								(fragmentSpreads || []).map((fragmentSpread) =>
									AST.tsPropertySignature(
										AST.identifier(fragmentSpread.name.value),
										AST.tsTypeAnnotation(
											AST.tsLiteralType(AST.booleanLiteral(true))
										)
									)
								)
							)
						)
					),
					allowReadonly
				)
			)
		}

		// if we are mixing in inline fragments, we need to a union of the possible options,
		// discriminated by the value of __typename
		const inlineFragmentSelections: {
			type: graphql.GraphQLNamedType
			tsType: TSTypeKind
		}[] = Object.entries(inlineFragments).flatMap(([typeName, fragment]) => {
			const fragmentRootType = config.schema.getType(typeName)
			if (!fragmentRootType) {
				return []
			}

			// generate the type for the inline fragment
			const fragmentType = inlineType({
				config,
				filepath,
				rootType: fragmentRootType,
				selections: fragment,
				allowReadonly,
				visitedTypes,
				root,
				body,
				missingScalars,
				includeFragments,
				allOptional,
			})

			// we need to handle __typename in the generated type. this means removing
			// it if it was declared by tsType and adding the right value
			let objectType = fragmentType
			// if we got a nullable field, we need to point at the type def
			if (fragmentType.type === 'TSUnionType') {
				for (const inner of fragmentType.types) {
					if (inner.type === 'TSTypeLiteral') {
						objectType = inner
					}
				}
			}

			if (
				objectType.type === 'TSTypeLiteral' &&
				!graphql.isInterfaceType(fragmentRootType) &&
				!graphql.isUnionType(fragmentRootType)
			) {
				const existingTypenameIndex = objectType.members.findIndex(
					(member) =>
						member.type === 'TSPropertySignature' &&
						member.key.type === 'Identifier' &&
						member.key.name === '__typename'
				)
				if (existingTypenameIndex !== -1) {
					objectType.members.splice(existingTypenameIndex, 1)
				}

				// add __typename to the list
				objectType.members.push(
					readonlyProperty(
						AST.tsPropertySignature(
							AST.identifier('__typename'),
							AST.tsTypeAnnotation(AST.tsLiteralType(AST.stringLiteral(typeName)))
						),
						allowReadonly
					)
				)
			}

			// we're done massaging the type
			return [{ type: fragmentRootType, tsType: fragmentType }]
		})

		//
		if (Object.keys(inlineFragmentSelections).length > 0) {
			// // build up the discriminated type
			let selectionTypes = Object.entries(inlineFragmentSelections).map(
				([typeName, { type, tsType }]) => {
					// the selection for a concrete type is really the intersection of itself
					// with every abstract type it implements. go over every fragment belonging
					// to an abstract type and check if this type implements it.
					return AST.tsParenthesizedType(
						AST.tsIntersectionType(
							[tsType]
								// remove any inner nullability flags
								.flatMap((type) => {
									// if we are looking at a union we might have nulls in there
									if (type.type === 'TSUnionType') {
										return type.types.filter(
											(innerType) =>
												innerType.type !== 'TSNullKeyword' &&
												innerType.type !== 'TSUndefinedKeyword'
										)
									}
									return type
								})
						)
					)
				}
			)

			// build up the list of fragment types
			result = AST.tsIntersectionType([
				result,
				AST.tsParenthesizedType(AST.tsUnionType(selectionTypes)),
			])
		}
	}
	// we shouldn't get here
	else {
		throw Error('Could not convert selection to typescript')
	}

	// we need to wrap the result in the right combination of nullable, list, and non-null markers
	for (const toWrap of wrappers) {
		if (!root && toWrap === TypeWrapper.Nullable) {
			result = nullableField(result)
		}
		// if its a non-null we don't need to add anything
		else if (toWrap === TypeWrapper.NonNull) {
			continue
		}
		// it could be a list
		else if (toWrap === TypeWrapper.List) {
			result = AST.tsArrayType(AST.tsParenthesizedType(result))
		}
	}

	return result
}

// look up the selection type info
export function selectionTypeInfo(
	schema: graphql.GraphQLSchema,
	filepath: string,
	rootType: graphql.GraphQLObjectType<any, any>,
	selection: graphql.SelectionNode
): { field: graphql.GraphQLField<any, any>; type: graphql.GraphQLNamedType } {
	// the field we are looking at
	const selectionName = (selection as graphql.FieldNode).name.value

	// look up the fields for the root object
	let fields: { [fieldName: string]: graphql.GraphQLField<any, any> } = {}

	// if the parent type in question is a union, there is only __typename
	if (selection.kind === 'Field' && selection.name.value === '__typename') {
		return {
			field: {
				name: '__typename',
				// @ts-ignore
				type: schema.getType('String')!,
				args: [],
			},
			type: schema.getType('String')!,
		}
	}
	// unwrap non-nulls
	else if (graphql.isNonNullType(rootType) && 'getFields' in rootType.ofType) {
		fields = rootType.ofType.getFields()
	}
	// anything else
	else {
		fields = rootType.getFields()
	}

	const field = fields[selectionName]

	if (!field) {
		throw new HoudiniError({
			filepath,
			message: `Could not find type information for field ${rootType.toString()}.${selectionName} ${field}`,
		})
	}
	const fieldType = graphql.getNamedType(field.type) as unknown as graphql.GraphQLNamedType
	if (!fieldType) {
		throw new HoudiniError({
			filepath,
			message: `Could not find type information for field ${rootType.toString()}.${selectionName} ${field}`,
		})
	}

	const fieldTypeName = fieldType.name

	// and the actual object type that it refers to
	// @ts-ignore
	const selectionType = schema.getType(fieldTypeName) as graphql.GraphQLObjectType
	if (!selectionType) {
		throw new HoudiniError({ filepath, message: 'Could not find type for ' + fieldTypeName })
	}

	return { field, type: selectionType }
}
