// externals
import path from 'path'
import * as recast from 'recast'
import * as graphql from 'graphql'
import { asyncWalk } from 'estree-walker'
import { TaggedTemplateExpression, Identifier } from 'estree'
import { OperationDefinitionNode } from 'graphql/language'
// locals
import {
	CompiledGraphqlOperation,
	CompiledGraphqlFragment,
	OperationDocumentKind,
	CompiledDocument,
} from './compile'

type PreProcessorConfig = {
	artifactDirectory: string
	artifactDirectoryAlias: string
	schema: graphql.GraphQLSchema
}

// pull out reused types
const typeBuilders = recast.types.builders
type Property = recast.types.namedTypes.ObjectProperty
type ArrowFunctionExpression = recast.types.namedTypes.ArrowFunctionExpression

// the houdini preprocessor is required to strip away the graphql tags
// and leave behind something for the runtime
export function preprocessor(config: PreProcessorConfig) {
	return {
		// the only thing we have to modify is the script blocks
		async script({ content, filename }: { content: string; filename: string }) {
			// parse the javascript content
			const parsed = recast.parse(content, {
				parser: require('recast/parsers/typescript'),
			})

			// the list of paths that should be "watched" alongside this file
			const relatedPaths: string[] = []

			// svelte walk over recast?
			await asyncWalk(parsed, {
				async enter(node, parent) {
					// if we are looking at the graphql template tag
					if (
						node.type === 'TaggedTemplateExpression' &&
						((node as TaggedTemplateExpression).tag as Identifier).name === 'graphql'
					) {
						const expr = node as TaggedTemplateExpression

						// we're going to replace the tag with something the runtime can use

						// first, lets parse the tag contents to get the info we need
						const parsedTag = graphql.parse(expr.quasi.quasis[0].value.raw)

						// make sure there is only one definition
						if (parsedTag.definitions.length > 1) {
							throw new Error('Encountered multiple definitions in a tag')
						}

						// pull out the name of the thing
						const operation = parsedTag.definitions[0] as OperationDefinitionNode
						const name = operation.name?.value

						// grab the document meta data
						let document: CompiledGraphqlOperation | CompiledGraphqlFragment
						try {
							// the location for the document artifact
							const documentPath = path.join(config.artifactDirectory, `${name}.js`)

							// try to resolve the compiled document
							document = await import(documentPath)

							// make sure we watch the compiled fragment
							relatedPaths.push(documentPath)
						} catch (e) {
							throw new Error(
								'Looks like you need to run the houdini compiler for ' + name
							)
						}

						// every graphql tag gets replaced by an object with similar fields
						const replacement = typeBuilders.objectExpression([
							typeBuilders.objectProperty(
								typeBuilders.stringLiteral('name'),
								typeBuilders.stringLiteral(document.name)
							),
							typeBuilders.objectProperty(
								typeBuilders.stringLiteral('kind'),
								typeBuilders.stringLiteral(document.kind)
							),
						])

						// if we are looking at an operation
						if (document.kind === OperationDocumentKind) {
							replacement.properties.push(
								...operationProperties(config, document, operation)
							)
						}
						// we are processing a fragment
						else {
							replacement.properties.push(
								...fragmentProperties(config, document, parsedTag)
							)
						}

						// perform the replacement
						this.replace(replacement)
					}
				},
			})

			// return the printed result
			return {
				...recast.print(parsed),
				dependencies: relatedPaths,
			}
		},
	}
}

export function operationProperties(
	config: PreProcessorConfig,
	operation: CompiledGraphqlOperation,
	doc: graphql.OperationDefinitionNode
): Property[] {
	// figure out the root type
	let rootType: graphql.GraphQLObjectType | null | undefined
	if (doc.operation === 'query') {
		rootType = config.schema.getQueryType()
	} else if (doc.operation === 'mutation') {
		rootType = config.schema.getMutationType()
	} else if (doc.operation === 'subscription') {
		rootType = config.schema.getSubscriptionType()
	}
	if (!rootType) {
		throw new Error('Could not find operation type')
	}

	// pass the raw query string for the network request
	return [
		typeBuilders.objectProperty(
			typeBuilders.stringLiteral('raw'),
			typeBuilders.stringLiteral(operation.raw)
		),
		typeBuilders.objectProperty(
			typeBuilders.stringLiteral('processResult'),
			selector({
				config,
				artifact: operation,
				rootIdentifier: 'data',
				rootType,
				selectionSet: doc.selectionSet,
				// grab values from the immediate response
				pullValuesFromRef: false,
			})
		),
	]
}

export function fragmentProperties(
	config: PreProcessorConfig,
	fragment: CompiledGraphqlFragment,
	doc: graphql.DocumentNode
): Property[] {
	const parsedFragment = doc.definitions[0] as graphql.FragmentDefinitionNode

	// the primary requirement for a fragment is the selector, a function that returns the requested
	// data from the object. we're going to build this up as a function

	// figure out the root type
	const rootType = config.schema.getType(
		parsedFragment.typeCondition.name.value
	) as graphql.GraphQLObjectType
	if (!rootType) {
		throw new Error(
			'Could not find type definition for fragment root' +
				parsedFragment.typeCondition.name.value
		)
	}

	// add the selector to the inlined object
	return [
		typeBuilders.objectProperty(
			typeBuilders.stringLiteral('selector'),
			selector({
				config,
				artifact: fragment,
				rootIdentifier: 'obj',
				rootType,
				selectionSet: parsedFragment.selectionSet,
			})
		),
	]
}

type SelectorProps = {
	config: PreProcessorConfig
	artifact: CompiledDocument
	rootIdentifier: string
	rootType: graphql.GraphQLObjectType
	selectionSet: graphql.SelectionSetNode
	pullValuesFromRef?: boolean
	includeRefField?: boolean
}

export function selector(props: SelectorProps): ArrowFunctionExpression {
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

			// the field we are looking at
			const field = rootType.getFields()[(selection as graphql.FieldNode).name.value]
			if (!field) {
				throw new Error('Could not find type information for field')
			}
			// and the actual object type that it refers to
			const selectionType = config.schema.getType(
				graphql.getNamedType(field.type).name
			) as graphql.GraphQLObjectType
			if (!selectionType) {
				throw new Error('Could not find type for ' + name)
			}

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
								rootIdentifier: `${rootIdentifier}_${attributeName}`,
								rootType: selectionType,
								selectionSet: selection.selectionSet,
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
							rootType: selectionType,
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

function memberExpression(root: string, next: string, ...rest: string[]) {
	// the object we are accessing
	let target = typeBuilders.memberExpression(
		typeBuilders.identifier(root),
		typeBuilders.identifier(next)
	)
	for (const member of rest) {
		target = typeBuilders.memberExpression(target, typeBuilders.identifier(member))
	}

	return target
}

function isListType(type: graphql.GraphQLType): boolean {
	// if the type is non-null, unwrap and check again
	if (graphql.isNonNullType(type)) {
		return isListType((type as graphql.GraphQLNonNull<any>).ofType)
	}

	return graphql.isListType(type)
}
