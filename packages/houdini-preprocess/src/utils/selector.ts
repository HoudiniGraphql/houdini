// externals
import * as graphql from 'graphql'
import * as recast from 'recast'
import { DocumentArtifact } from 'houdini-compiler'
import { Config, selectionTypeInfo, isListType } from 'houdini-common'
// locals
import memberExpression from './memberExpression'

const typeBuilders = recast.types.builders
type Property = recast.types.namedTypes.ObjectProperty
type ArrowFunctionExpression = recast.types.namedTypes.ArrowFunctionExpression

type SelectorProps = {
	config: Config
	artifact: DocumentArtifact
	rootIdentifier: string
	rootType: graphql.GraphQLObjectType
	selectionSet: graphql.SelectionSetNode
	pullValuesFromRef?: boolean
	includeRefField?: boolean
}

export default function selector(props: SelectorProps): ArrowFunctionExpression {
	return typeBuilders.arrowFunctionExpression(
		[typeBuilders.identifier(props.rootIdentifier)],
		typeBuilders.blockStatement([
			typeBuilders.returnStatement(typeBuilders.objectExpression(objectProperties(props))),
		])
	)
}

function objectProperties({
	config,
	artifact,
	rootIdentifier,
	rootType,
	selectionSet,
	includeRefField = true,
	pullValuesFromRef = true,
}: SelectorProps): Property[] {
	return [
		// optionally include the embedded ref
		...(includeRefField
			? [
					typeBuilders.objectProperty(
						typeBuilders.stringLiteral('__ref'),
						pullValuesFromRef
							? memberExpression(rootIdentifier, '__ref')
							: typeBuilders.identifier(rootIdentifier)
					),
			  ]
			: []),

		// process every selection in the selection set
		...selectionSet.selections.flatMap((selection) => {
			// if the selection is a spread of another fragment, ignore it
			if (selection.kind === graphql.Kind.FRAGMENT_SPREAD) {
				return []
			}

			// if the selection is an inline fragment (has no name) we should process it first
			// to dry up the rest of the conditions
			if (selection.kind === graphql.Kind.INLINE_FRAGMENT) {
				return objectProperties({
					config,
					artifact,
					rootIdentifier,
					rootType,
					selectionSet: selection.selectionSet,
					includeRefField: false,
				})
			}

			// the name of the field in the response
			const attributeName = selection.alias?.value || selection.name.value
			const { type: attributeType, field } = selectionTypeInfo(
				config.schema,
				rootType,
				selection
			)

			// if the selection is a field without any sub selections
			if (
				selection.kind === graphql.Kind.FIELD &&
				!selection.selectionSet?.selections.length
			) {
				// we need to add a key to the object that points {attributeName} to obj._ref.{attributeName}
				return typeBuilders.objectProperty(
					typeBuilders.stringLiteral(attributeName),

					pullValuesFromRef
						? memberExpression(rootIdentifier, '__ref', attributeName)
						: memberExpression(rootIdentifier, attributeName)
				)
			}

			// if the field is a lists
			if (
				selection.kind === graphql.Kind.FIELD &&
				isListType(field.type) &&
				// this will always be true in order to be a valid graphql document
				// but im leaving it here to make typescript happy
				selection.selectionSet !== undefined
			) {
				// we need an identifier that is garunteed not to conflict with fields that could be
				// arbitrarily deep. to address this we'll use the field location as the name
				const argument = `${rootIdentifier}_${attributeName}`
					.replace('.__ref', '')
					.replace('.', '_')

				// we need to transform every entry in this list to a masked version
				return typeBuilders.objectProperty(
					typeBuilders.stringLiteral(attributeName),
					// invoke {rootIdentifier}.__ref.{attributeName}.map
					typeBuilders.callExpression(
						pullValuesFromRef
							? memberExpression(rootIdentifier, '__ref', attributeName, 'map')
							: memberExpression(rootIdentifier, attributeName, 'map'),

						// pass the selector to the functor
						[
							selector({
								config,
								artifact,
								rootIdentifier: argument,
								rootType: attributeType as graphql.GraphQLObjectType<any, any>,
								selectionSet: selection.selectionSet,
								pullValuesFromRef,
							}),
						]
					)
				)
			}

			// the selection is neither a field, nor a list so it must be related object.
			// wrap it in an presumed-true predicate to catch edge cases we don't know about
			if (selection.kind === graphql.Kind.FIELD && selection.selectionSet !== undefined) {
				// we need to return a single field that's equal to the masked version of the
				// related object
				return typeBuilders.objectProperty(
					typeBuilders.identifier(JSON.stringify(attributeName)),
					typeBuilders.objectExpression(
						objectProperties({
							config,
							artifact,
							rootIdentifier: pullValuesFromRef
								? `${rootIdentifier}.__ref.${attributeName}`
								: `${rootIdentifier}.${attributeName}`,
							rootType: attributeType as graphql.GraphQLObjectType<any, any>,
							selectionSet: selection.selectionSet,
							pullValuesFromRef,
						})
					)
				)
			}

			// if we got this far, we dont recognize the selection kind
			throw new Error('Could not create selector for selection type: ' + selection.kind)
		}),
	]
}
