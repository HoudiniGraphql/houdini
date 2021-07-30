// externals
import { Config, selectionTypeInfo } from 'houdini-common'
import * as recast from 'recast'
import * as graphql from 'graphql'
import { TSTypeKind, StatementKind } from 'ast-types/gen/kinds'
// locals
import { TypeWrapper, unwrapType } from '../../utils'
import { enumDeclaration, nullableField, readonlyProperty, scalarPropertyValue } from './types'

const AST = recast.types.builders

export const fragmentKey = '$fragments'

export function inlineType({
	config,
	rootType,
	selections,
	root,
	allowReadonly,
	body,
	visitedTypes,
}: {
	config: Config
	rootType: graphql.GraphQLNamedType
	selections: readonly graphql.SelectionNode[] | undefined
	root: boolean
	allowReadonly: boolean
	body: StatementKind[]
	visitedTypes: Set<string>
}): TSTypeKind {
	// start unwrapping non-nulls and lists (we'll wrap it back up before we return)
	const { type, wrappers } = unwrapType(config, rootType)

	let result: TSTypeKind
	// if we are looking at a scalar field
	if (graphql.isScalarType(type)) {
		result = scalarPropertyValue(config, type as graphql.GraphQLNamedType)
	}
	// we could have encountered an enum
	else if (graphql.isEnumType(type)) {
		// have we seen the enum before
		if (!visitedTypes.has(type.name)) {
			// add the enum declaration to the body
			body.push(enumDeclaration(type))

			// register that we've visited the type already
			visitedTypes.add(type.name)
		}

		result = AST.tsTypeReference(AST.identifier(type.name))
	}
	// if we are looking at something with a selection set
	else if (selections && selections?.length > 0) {
		const rootObj = type as graphql.GraphQLObjectType<any, any>

		// before we can begin, we need to sort the selection set for this field for
		// fields defined on the interface as well as subtypes of the interface
		const inlineFragments: graphql.InlineFragmentNode[] = []
		// the rest of the selection can be a single type in the union
		const selectedFields: graphql.SelectionNode[] = []

		for (const selection of selections) {
			// if we found an inline fragment then we have a sub-condition on the fragment
			if (selection.kind === 'InlineFragment') {
				inlineFragments.push(selection)
			} else {
				selectedFields.push(selection)
			}
		}

		// turn the set of selected fields into their own type
		result = AST.tsTypeLiteral([
			// every field gets an entry in the object
			...((selectedFields || []).filter(
				(field) => field.kind === 'Field'
			) as graphql.FieldNode[]).map((selection) => {
				// grab the type info for the selection
				const { type, field } = selectionTypeInfo(config.schema, rootObj, selection)

				// figure out the response name
				const attributeName = selection.alias?.value || selection.name.value

				// figure out the corresponding typescript type
				let attributeType = inlineType({
					config,
					rootType: field.type as graphql.GraphQLNamedType,
					selections: selection.selectionSet?.selections as graphql.SelectionNode[],
					root: false,
					allowReadonly,
					visitedTypes,
					body,
				})

				// we're done
				return readonlyProperty(
					AST.tsPropertySignature(
						AST.identifier(attributeName),
						AST.tsTypeAnnotation(attributeType)
					),
					allowReadonly
				)
			}),
		])

		// embed any referenced fragments in the result
		const fragmentSpreads = selections?.filter(({ kind }) => kind === 'FragmentSpread') as
			| graphql.FragmentSpreadNode[]
			| undefined
		if (fragmentSpreads && fragmentSpreads.length) {
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
		}[] = inlineFragments.flatMap((fragment: graphql.InlineFragmentNode) => {
			// look up the type pointed by the type condition
			if (!fragment.typeCondition) {
				return []
			}
			const typeName = fragment.typeCondition.name.value
			const fragmentRootType = config.schema.getType(typeName)
			if (!fragmentRootType) {
				return []
			}

			// generate the type for the inline fragment
			const fragmentType = inlineType({
				config,
				rootType: fragmentRootType,
				selections: fragment.selectionSet.selections,
				allowReadonly,
				visitedTypes,
				root,
				body,
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
		if (inlineFragmentSelections.length > 0) {
			// these fragments could refer to types, unions, or interfaces
			// only mix the relevant ones
			const interfaceFragments = inlineFragmentSelections.filter(({ type }) =>
				graphql.isInterfaceType(type)
			)
			const unionFragments = inlineFragmentSelections.filter(({ type }) =>
				graphql.isUnionType(type)
			)
			const concreteFragments = inlineFragmentSelections.filter(({ type }) => {
				// look up the type in the schema
				return !graphql.isUnionType(type) && !graphql.isInterfaceType(type)
			})

			// build up the discriminated type
			let selectionTypes = concreteFragments.map(({ type, tsType }) => {
				// the selection for a concrete type is really the intersection of itself
				// with every abstract type it implements. go over every fragment belonging
				// to an abstract type and check if this type implements it.
				return AST.tsParenthesizedType(
					AST.tsIntersectionType(
						[tsType]
							// include the interface fragment if the concrete type implements it
							.concat(
								interfaceFragments
									.filter(({ type: abstractType }) =>
										config.schema
											.getImplementations(
												abstractType as graphql.GraphQLInterfaceType
											)
											.objects.map(({ name }) => name)
											.includes(type.name)
									)
									.map(({ tsType }) => tsType)
							)
							// include the union fragment if the concrete type is a member
							.concat(
								unionFragments
									.filter(({ type }) => {
										console.log(type)
										return true
									})
									.map(({ tsType }) => tsType)
							)
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
			})

			// build up the list of fragment types
			result = AST.tsIntersectionType([
				result,
				AST.tsParenthesizedType(AST.tsUnionType(selectionTypes)),
			])
			// if we're supposed to leave a nullable type behind
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
