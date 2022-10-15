import { logGreen, logYellow } from '@kitql/helper'
import * as graphql from 'graphql'

import {
	Config,
	parentTypeFromAncestors,
	HoudiniError,
	CollectedGraphQLDocument,
	siteURL,
} from '../../lib'
import { ArtifactKind } from '../../runtime/lib/types'
import { TypeWrapper, unwrapType } from '../utils'
import { pageInfoSelection } from './paginate'

// addListFragments adds fragments for the fields tagged with @list
export default async function addListFragments(
	config: Config,
	documents: CollectedGraphQLDocument[]
): Promise<void> {
	// collect all of the fields that have the list applied
	const lists: {
		[name: string]: {
			selection: graphql.SelectionSetNode | undefined
			type: graphql.GraphQLNamedType
			filename: string
		}
	} = {}

	const errors: Error[] = []

	// look at every document
	for (const doc of documents) {
		doc.document = graphql.visit(doc.document, {
			Directive(node, key, parent, path, ancestors) {
				// if we found a @list applied (or a @paginate which implies a @list )
				if ([config.listDirective, config.paginateDirective].includes(node.name.value)) {
					// look up the name passed to the directive
					const nameArg = node.arguments?.find((arg) => arg.name.value === 'name')

					// if we need to use an error relative to this node
					let error = {
						...new graphql.GraphQLError(
							'',
							node,
							new graphql.Source(''),
							node.loc ? [node.loc.start, node.loc.end] : null,
							path
						),
						filepath: doc.filename,
					}

					// if there is no name argument
					if (!nameArg) {
						// if we are looking at a @list we need a name argument
						if (node.name.value === config.listDirective) {
							error.message = `@${node.name.value} must have a name argument`
							errors.push(error)
						}

						// regardless, we don't need to process this node any more
						return
					}

					// make sure it was a string
					if (nameArg.value.kind !== 'StringValue') {
						error.message = `@${node.name.value} name must be a string`
						errors.push(error)
						return
					}

					// if we've already seen this list
					if (lists[nameArg.value.value]) {
						error.message = `@${node.name.value} name must be unique`
						errors.push(error)
					}

					// look up the parent's type
					const parentType = parentTypeFromAncestors(
						config.schema,
						doc.filename,
						ancestors.slice(0, -1)
					)

					// a non-connection list can just use the selection set of the tagged field
					// but if this is a connection tagged with list we need to use the selection
					// of the edges.node field
					const targetField = ancestors[ancestors.length - 1] as graphql.FieldNode
					const targetFieldDefinition = parentType.getFields()[
						targetField.name.value
					] as graphql.GraphQLField<any, any>

					const { selection, type, connection } = connectionSelection(
						config,
						targetFieldDefinition,
						parentTypeFromAncestors(
							config.schema,
							doc.filename,
							ancestors
						) as graphql.GraphQLObjectType,
						(ancestors[ancestors.length - 1] as graphql.FieldNode).selectionSet
					)

					// add the target of the directive to the list
					lists[nameArg.value.value] = {
						selection,
						type,
						filename: doc.filename,
					}

					// if the list is marking a connection we need to add the flag in a place we can track when
					// generating the artifact
					if (connection) {
						return {
							...node,
							arguments: [
								...node.arguments!,
								{
									kind: 'Argument',
									name: {
										kind: graphql.Kind.NAME,
										value: 'connection',
									},
									value: {
										kind: 'BooleanValue',
										value: true,
									},
								} as graphql.ArgumentNode,
							],
						}
					}
				}
			},
			Field(node, key, parent, path, ancestors) {
				// if the is marked with @list and is a connection, we need to make sure that we ask for
				// the cursor fields
				if (
					!node.directives?.find(
						(directive) => directive.name.value === config.listDirective
					)
				) {
					return
				}

				// the field is a list, is it a connection?

				// look up the parent's type
				const parentType = parentTypeFromAncestors(config.schema, doc.filename, ancestors)
				// a non-connection list can just use the selection set of the tagged field
				// but if this is a connection tagged with list we need to use the selection
				// of the edges.node field
				const targetField = node
				const targetFieldDefinition = parentType.getFields()[
					targetField.name.value
				] as graphql.GraphQLField<any, any>

				const { connection } = connectionSelection(
					config,
					targetFieldDefinition,
					parentTypeFromAncestors(
						config.schema,
						doc.filename,
						ancestors
					) as graphql.GraphQLObjectType,
					node.selectionSet
				)

				// if the field is a connection, add the cursor
				if (connection) {
					return {
						...node,
						selectionSet: {
							...node.selectionSet,
							selections: [...node.selectionSet!.selections, ...pageInfoSelection],
						},
					}
				}
			},
		})
	}

	// if we ran into any errors
	if (errors.length > 0) {
		throw errors
	}

	// we need to add a delete directive for every type that is the target of a list
	const listTargets = [
		...new Set(
			Object.values(lists).map(({ type }) => {
				// only consider object types
				if (!(type instanceof graphql.GraphQLObjectType)) {
					return ''
				}

				return type.name
			})
		).values(),
	].filter(Boolean)

	// if there are no documents, we don't have anything to do
	if (Object.keys(lists).length === 0) {
		return
	}

	// we need to add the fragment definitions __somewhere__ where they will be picked up
	// so we're going to add them to the list of documents, one each
	const generatedDoc: graphql.DocumentNode = {
		kind: graphql.Kind.DOCUMENT,
		definitions: (
			Object.entries(lists).flatMap<graphql.FragmentDefinitionNode>(
				([name, { selection, type }]) => {
					// look up the type
					const schemaType = config.schema.getType(type.name) as graphql.GraphQLObjectType

					// if there is no selection set
					if (!selection) {
						throw new HoudiniError({ message: 'Lists must have a selection' })
					}

					// we need a copy of the field's selection set that we can mutate
					const fragmentSelection: graphql.SelectionSetNode = {
						kind: graphql.Kind.SELECTION_SET,
						selections: [...selection.selections],
					}

					// is there no id selection
					if (
						schemaType &&
						fragmentSelection &&
						!fragmentSelection?.selections.find(
							(field) => field.kind === 'Field' && field.name.value === 'id'
						)
					) {
						// add the id field to the selection
						fragmentSelection.selections = [
							...fragmentSelection.selections,
							{
								kind: graphql.Kind.FIELD,
								name: {
									kind: graphql.Kind.NAME,
									value: 'id',
								},
							},
						]
					}

					// we at least want to create fragment to indicate inserts in lists
					return [
						// a fragment to insert items into this list
						{
							name: {
								value: config.listInsertFragment(name),
								kind: graphql.Kind.NAME,
							},
							kind: graphql.Kind.FRAGMENT_DEFINITION,
							// in order to insert an item into this list, it must
							// have the same selection as the field
							selectionSet: fragmentSelection,
							typeCondition: {
								kind: graphql.Kind.NAMED_TYPE,
								name: {
									kind: graphql.Kind.NAME,
									value: type.name,
								},
							},
						},
						// a fragment to insert or remove an item into the list
						{
							name: {
								value: config.listToggleFragment(name),
								kind: graphql.Kind.NAME,
							},
							kind: graphql.Kind.FRAGMENT_DEFINITION,
							// in order to insert an item into this list, it must
							// have the same selection as the field
							selectionSet: {
								...fragmentSelection,
								selections: [
									...fragmentSelection.selections,
									{
										kind: graphql.Kind.FIELD,
										name: {
											kind: graphql.Kind.NAME,
											value: 'id',
										},
									},
								],
							},
							typeCondition: {
								kind: graphql.Kind.NAMED_TYPE,
								name: {
									kind: graphql.Kind.NAME,
									value: type.name,
								},
							},
						},
						// add a fragment to remove from the specific list
						{
							kind: graphql.Kind.FRAGMENT_DEFINITION,
							name: {
								value: config.listRemoveFragment(name),
								kind: graphql.Kind.NAME,
							},
							// deleting an entity just takes its id and the parent
							selectionSet: {
								kind: graphql.Kind.SELECTION_SET,
								selections: [
									{
										kind: graphql.Kind.FIELD,
										name: {
											kind: graphql.Kind.NAME,
											value: 'id',
										},
									},
								],
							},
							typeCondition: {
								kind: graphql.Kind.NAMED_TYPE,
								name: {
									kind: graphql.Kind.NAME,
									value: type.name,
								},
							},
						},
					]
				}
			) as graphql.DefinitionNode[]
		).concat(
			...listTargets.map<graphql.DirectiveDefinitionNode>((typeName) => ({
				kind: graphql.Kind.DIRECTIVE_DEFINITION,
				name: {
					kind: graphql.Kind.NAME,
					value: config.listDeleteDirective(typeName),
				},
				locations: [
					// the delete directive must be applied to a field in the response
					// corresponding to the id
					{
						kind: graphql.Kind.NAME,
						value: 'FIELD',
					},
				],
				repeatable: true,
			}))
		),
	}

	config.newSchema +=
		'\n' +
		generatedDoc.definitions
			.filter((c) => c.kind !== 'FragmentDefinition')
			.map(graphql.print)
			.join('\n\n')
	config.newDocuments +=
		'\n' +
		generatedDoc.definitions
			.filter((c) => c.kind === 'FragmentDefinition')
			.map(graphql.print)
			.join('\n\n')

	documents.push({
		name: 'generated::lists',
		kind: ArtifactKind.Fragment,
		generateArtifact: false,
		generateStore: false,
		document: generatedDoc,
		originalDocument: generatedDoc,
		filename: 'generated::lists',
		originalString: '',
	})
}

// a field is considered a connection if it has one of the required connection arguments
// as well as an edges > node selection
export function connectionSelection(
	config: Config,
	field: graphql.GraphQLField<any, any>,
	type: graphql.GraphQLObjectType,
	selection: graphql.SelectionSetNode | undefined
): {
	selection: graphql.SelectionSetNode | undefined
	type: graphql.GraphQLObjectType
	connection: boolean
	error: string | null
} {
	// make sure the field has the fields for either forward or backwards pagination
	const fieldArgs = field.args.reduce<Record<string, string>>(
		(args, arg) => ({
			...args,
			[arg.name]: unwrapType(config, arg.type).type.name,
		}),
		{}
	)

	// if the field has an argument for limit, we're good to go
	if (fieldArgs['limit']) {
		return { selection, type, connection: false, error: null }
	}

	const forwardPagination =
		fieldArgs['first'] === 'Int' && ['Cursor', 'String'].includes(fieldArgs['after'])
	const backwardsPagination =
		fieldArgs['last'] === 'Int' && ['Cursor', 'String'].includes(fieldArgs['before'])
	if (!forwardPagination && !backwardsPagination) {
		return { selection, type, connection: false, error: missingPaginationArgMessage(config) }
	}

	// we need to make sure that there is an edges field
	const edgesField = selection?.selections.find(
		(selection) => selection.kind === 'Field' && selection.name.value === 'edges'
	) as graphql.FieldNode
	if (!edgesField) {
		return { selection, type, connection: false, error: missingEdgeSelectionMessage(config) }
	}

	const nodeSelection = edgesField.selectionSet?.selections.find(
		(selection) => selection.kind === 'Field' && selection.name.value === 'node'
	) as graphql.FieldNode
	if (!nodeSelection.selectionSet) {
		return { selection, type, connection: false, error: missingNodeSelectionMessage(config) }
	}

	// now that we have the correct selection, we have to lookup node type
	// we need to make sure that there is an edges field
	const edgeField = (
		unwrapType(config, field.type).type as graphql.GraphQLObjectType
	).getFields()['edges']
	const { wrappers, type: edgeFieldType } = unwrapType(config, edgeField.type)
	// wrappers are in reverse order (last one is the top level, and there's a nullable entry)
	// so a nullable list of non-null elements looks like [NonNull, List, Nullable].
	// this means we just have to look at the second to last element and check if its a list
	const list = wrappers[wrappers.length - 2] === TypeWrapper.List
	if (!list) {
		return { selection, type, connection: false, error: edgeInvalidTypeMessage(config) }
	}

	const nodeField = (edgeFieldType as graphql.GraphQLObjectType).getFields()['node']
	if (!nodeField) {
		return { selection, type, connection: false, error: nodeNotDefinedMessage(config) }
	}

	return {
		selection: nodeSelection.selectionSet,
		type: unwrapType(config, nodeField.type).type as graphql.GraphQLObjectType,
		connection: true,
		error: null,
	}
}

const missingPaginationArgMessage = (
	config: Config
) => `Looks like you are trying to use the ${logGreen(
	`@${config.paginateDirective}`
)} directive on a field but have not provided a ${logYellow('first')}, ${logYellow(
	'last'
)}, or ${logYellow('limit')} argument. Please add one and try again.
For more information, visit this link: ${siteURL}/guides/pagination`

const missingEdgeSelectionMessage = (
	config: Config
) => `Looks like you are trying to use the ${logGreen(
	`@${config.paginateDirective}`
)} directive on a field but your selection does not contain an ${logYellow(
	'edges'
)} field. Please add one and try again.
For more information, visit this link: ${siteURL}/guides/pagination`

const missingNodeSelectionMessage = (
	config: Config
) => `Looks like you are trying to use the ${logGreen(
	`@${config.paginateDirective}`
)} directive on a field but your selection does not contain a ${logYellow(
	'node'
)} field. Please add one and try again.
For more information, visit this link: ${siteURL}/guides/pagination`

const edgeInvalidTypeMessage = (config: Config) => `Looks like you are trying to use the ${logGreen(
	`@${config.paginateDirective}`
)} directive on a field but your field does not conform to the connection spec: your edges field seems strange.
For more information, visit this link: ${siteURL}/guides/pagination`

const nodeNotDefinedMessage = (config: Config) => `Looks like you are trying to use the ${logGreen(
	`@${config.paginateDirective}`
)} directive on a field but your field does not conform to the connection spec: your edge type does not have node as a field.
For more information, visit this link: ${siteURL}/guides/pagination`
