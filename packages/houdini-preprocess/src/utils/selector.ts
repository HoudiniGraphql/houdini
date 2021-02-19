// externals
import * as graphql from 'graphql'
import * as recast from 'recast'
import { DocumentArtifact } from 'houdini-compiler'
import { Config, selectionTypeInfo, isListType, getTypeFromAncestors } from 'houdini-common'
// locals
import memberExpression from './memberExpression'

const AST = recast.types.builders
type Property = recast.types.namedTypes.ObjectProperty
type ArrowFunctionExpression = recast.types.namedTypes.ArrowFunctionExpression

export type SelectorProps = {
	config: Config
	artifact: DocumentArtifact
	rootIdentifier: string
	rootType: graphql.GraphQLObjectType
	selectionSet: graphql.SelectionSetNode
	pullValuesFromRef?: boolean
	includeRefField?: boolean
	root?: boolean
}

export default function selector(props: SelectorProps): ArrowFunctionExpression {
	// before we build up the actual function, we might need to collect all of the connection filters
	let fields: Property[] = []
	if (props.root) {
		// the connections that provide filters will emebed keys in the result
		const connectionFilters: Property[] = []

		graphql.visit(graphql.parse(props.artifact.raw), {
			Directive: {
				enter(node, _, __, ___, ancestors) {
					// look for connections
					if (node.name.value === props.config.connectionDirective) {
						const parent = ancestors[ancestors.length - 1] as graphql.FieldNode

						// find the name arg
						const nameArg = node.arguments?.find(({name}) => name.value === 'name')
						if (!nameArg || nameArg.value.kind !== 'StringValue') {
							throw new Error('cant find name')
						}

						connectionFilters.push(
							AST.objectProperty(
								AST.stringLiteral(nameArg.value.value),
								AST.objectExpression(
									(parent.arguments || []).flatMap((arg) => {
										// figure out the kind and value for the filter
										let kind
										let value

										if (arg.value.kind === graphql.Kind.INT) {
											kind = "Int"
											value = AST.stringLiteral(arg.value.value)
										}
										 else if (arg.value.kind === graphql.Kind.FLOAT) {
											kind = "Float"
											value = AST.stringLiteral(arg.value.value)
										}
										 else if (arg.value.kind === graphql.Kind.BOOLEAN) {
											kind = "Boolean"
											value = AST.booleanLiteral(arg.value.value)
										}
										 else if (arg.value.kind === graphql.Kind.VARIABLE) {
											kind = "Variable"
											value = AST.stringLiteral(arg.value.name.value)
										}
										 else if (arg.value.kind === graphql.Kind.STRING) {
											kind = "String"
											value = AST.stringLiteral(arg.value.value)
										}

										if (!kind || !value) {
											return []
										}

										
										return[ 
											AST.objectProperty(
												AST.stringLiteral(arg.name.value),
												AST.objectExpression([
													AST.objectProperty(AST.stringLiteral("kind"), AST.stringLiteral(kind)),
													AST.objectProperty(AST.stringLiteral("value"), value),
												])
											)
										]
									})
								)
							)
						)
					}
				},
			},
		})

		// if there are connections we care about
		if (connectionFilters.length > 0) {
			fields.push(
				AST.objectProperty(
					AST.stringLiteral('__connectionFilters'),
					AST.objectExpression(connectionFilters)
				)
			)
		}
	}

	return AST.arrowFunctionExpression(
		// if we are at the top of the function definition, we need to define `variables`
		[AST.identifier(props.rootIdentifier)].concat(
			props.root ? AST.identifier('variables') : []
		),
		// add the field values to the default ones
		AST.blockStatement([
			AST.returnStatement(AST.objectExpression(fields.concat(objectProperties(props)))),
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
					AST.objectProperty(
						AST.stringLiteral('__ref'),
						pullValuesFromRef
							? memberExpression(rootIdentifier, '__ref')
							: AST.identifier(rootIdentifier)
					),
			  ]
			: []),

		AST.objectProperty(AST.stringLiteral('__variables'), AST.identifier('variables')),

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

					// make sure we dont include __variables
				}).filter(
					(property) =>
						property.key.type === 'StringLiteral' &&
						property.key.value !== '__variables'
				)
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
				return AST.objectProperty(
					AST.stringLiteral(attributeName),

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
				return AST.objectProperty(
					AST.stringLiteral(attributeName),
					// invoke {rootIdentifier}.__ref.{attributeName}.map
					AST.callExpression(
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
				return AST.objectProperty(
					AST.identifier(JSON.stringify(attributeName)),
					AST.objectExpression(
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
