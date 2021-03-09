// externals
import { Config, getRootType, hashDocument, getTypeFromAncestors } from 'houdini-common'
import * as graphql from 'graphql'
import {
	CompiledQueryKind,
	CompiledFragmentKind,
	CompiledMutationKind,
	CompiledDocumentKind,
} from '../types'
import * as recast from 'recast'
import fs from 'fs/promises'
import { namedTypes } from 'ast-types/gen/namedTypes'
// locals
import { CollectedGraphQLDocument } from '../types'
import { moduleExport } from '../utils'
import { ConnectionWhen, MutationOperation } from './runtime/template'

const AST = recast.types.builders

// the artifact generator creates files in the runtime directory for each
// document containing meta data that the preprocessor might use
export default async function artifactGenerator(config: Config, docs: CollectedGraphQLDocument[]) {
	// put together the type information for the filter for every connection
	const filterTypes: FilterMap = {}

	for (const doc of docs) {
		graphql.visit(doc.document, {
			// look for any field marked with a connection
			Directive(node, _, __, ___, ancestors) {
				// we only care about connections
				if (node.name.value !== config.connectionDirective) {
					return
				}

				// get the name of the connection
				const nameArg = node.arguments?.find(
					(arg) => arg.name.value === config.connectionNameArg
				)
				if (!nameArg || nameArg.value.kind !== 'StringValue') {
					throw new Error('could not find name arg in connection directive')
				}
				const connectionName = nameArg.value.value

				// look up the actual field in the acestor list so we can get type info
				let field = ancestors[ancestors.length - 1] as graphql.FieldNode
				let i = 1
				while (Array.isArray(field)) {
					i++
					field = ancestors[ancestors.length - i] as graphql.FieldNode
				}
				if (field.kind !== 'Field') {
					return
				}

				// we need to traverse the ancestors from child up
				const parents = [...ancestors] as (
					| graphql.OperationDefinitionNode
					| graphql.FragmentDefinitionNode
					| graphql.SelectionNode
				)[]
				parents.reverse()

				// look up the parent's type so we can ask about the field marked as a connection
				const parentType = getTypeFromAncestors(config.schema, [
					...parents.slice(1),
				]) as graphql.GraphQLObjectType
				const parentField = parentType.getFields()[field.name.value]
				if (!parentField) {
					throw new Error('Could not find field information when computing filters')
				}
				const fieldType = getRootType(parentField.type).toString()

				// look at every arg on the connection to figure out the valid filters
				filterTypes[connectionName] = parentField.args.reduce((prev, arg) => {
					return {
						...prev,
						[arg.name]: getRootType(arg.type).toString(),
					}
				}, {})

				// the delete directive is an interesting one since there isn't a specific
				// connection. use something that points to deleting an instance of the type
				// every field with the connection type adds to the delete filters
				filterTypes[`${fieldType}_delete`] = {
					...filterTypes[`${fieldType}_delete`],
					...filterTypes[connectionName],
				}
			},
		})
	}

	// we have everything we need to generate the artifacts
	await Promise.all(
		docs.map(async ({ document, name, printed }) => {
			// before we can print the document, we need to strip all references to internal directives
			const rawString = graphql.print(
				graphql.visit(document, {
					Directive(node) {
						// if the directive is one of the internal ones, remove it
						if (config.isInternalDirective(node)) {
							return null
						}
					},
				})
			)

			// figure out the document kind
			let docKind: CompiledDocumentKind | null = null

			// look for the operation
			const operations = document.definitions.filter(
				({ kind }) => kind === graphql.Kind.OPERATION_DEFINITION
			) as graphql.OperationDefinitionNode[]
			// there are no operations, so its a fragment
			const fragments = document.definitions.filter(
				({ kind }) => kind === graphql.Kind.FRAGMENT_DEFINITION
			) as graphql.FragmentDefinitionNode[]

			// if there are operations in the document
			if (operations.length > 0) {
				// figure out if its a query
				if (
					operations[0].kind === graphql.Kind.OPERATION_DEFINITION &&
					operations[0].operation === 'query'
				) {
					docKind = CompiledQueryKind
				}
				// or a mutation
				else {
					docKind = CompiledMutationKind
				}
			}
			// if there are operations in the document
			else if (fragments.length > 0) {
				docKind = CompiledFragmentKind
			}

			// if we couldn't figure out the kind
			if (!docKind) {
				throw new Error('Could not figure out what kind of document we were given')
			}

			// generate a hash of the document that we can use to detect changes
			// start building up the artifact
			const artifact = AST.program([
				moduleExport('name', AST.stringLiteral(name)),
				moduleExport('kind', AST.stringLiteral(docKind)),
				moduleExport('hash', AST.stringLiteral(hashDocument(printed))),
				moduleExport(
					'raw',
					AST.templateLiteral(
						[AST.templateElement({ raw: rawString, cooked: rawString }, true)],
						[]
					)
				),
			])

			let rootType: string | undefined = ''
			let selectionSet: graphql.SelectionSetNode

			// if we are generating the artifact for an operation
			if (docKind !== 'HoudiniFragment') {
				// find the operation
				const operation = operations[0]

				if (operation.operation === 'query') {
					rootType = config.schema.getQueryType()?.name
				} else if (operation.operation === 'mutation') {
					rootType = config.schema.getMutationType()?.name
				} else if (operation.operation === 'subscription') {
					rootType = config.schema.getSubscriptionType()?.name
				}
				if (!rootType) {
					throw new Error('Could not find root type for field map')
				}

				// use this selection set
				selectionSet = operation.selectionSet
			}
			// we are looking at a fragment so use its selection set and type for the subscribe index
			else {
				rootType = fragments[0].typeCondition.name.value
				selectionSet = fragments[0].selectionSet
			}

			// add the selection information so we can subscribe to the store
			artifact.body.push(
				moduleExport('rootType', AST.stringLiteral(rootType)),
				moduleExport(
					'selection',
					selection({
						config,
						printed,
						rootType,
						selectionSet: selectionSet,
						operations: operationsByPath(config, operations[0], filterTypes),
						// do not include used fragments if we are rendering the selection
						// for a fragment document
						includeFragments: docKind !== 'HoudiniFragment',
						document,
					})
				)
			)

			// write the result to the artifact path we're configured to write to
			await fs.writeFile(config.artifactPath(document), recast.print(artifact).code)

			// log the file location to confirm
			if (!config.quiet) {
				console.log(name)
			}
		})
	)
}

function selection({
	config,
	rootType,
	selectionSet,
	operations,
	printed,
	path = [],
	includeFragments,
	document,
}: {
	config: Config
	rootType: string
	printed: string
	selectionSet: graphql.SelectionSetNode
	operations: { [path: string]: namedTypes.ArrayExpression }
	path?: string[]
	includeFragments: boolean
	document: graphql.DocumentNode
}): namedTypes.ObjectExpression {
	// we need to build up an object that contains every field in the selection
	const object = AST.objectExpression([])

	for (const field of selectionSet.selections) {
		// ignore fragment spreads
		if (field.kind === 'FragmentSpread' && includeFragments) {
			// look up the fragment definition
			const fragmentDefinition = document.definitions.find(
				(defn) => defn.kind === 'FragmentDefinition' && defn.name.value === field.name.value
			) as graphql.FragmentDefinitionNode
			if (!fragmentDefinition) {
				throw new Error('Could not find definition for fragment ' + field.name.value)
			}

			const fragmentFields = selection({
				config,
				rootType: fragmentDefinition.typeCondition.name.value,
				operations,
				selectionSet: fragmentDefinition.selectionSet,
				path,
				printed,
				includeFragments,
				document,
			})
			for (const property of fragmentFields.properties) {
				object.properties.push(
					...fragmentFields.properties.filter(
						(prop) => prop.type === 'ObjectProperty' && prop.key
					)
				)
			}
		}
		// inline fragments should be merged with the parent
		else if (field.kind === 'InlineFragment') {
			const inlineFragment = selection({
				config,
				rootType,
				operations,
				selectionSet: field.selectionSet,
				path,
				printed,
				includeFragments,
				document,
			})
			for (const property of inlineFragment.properties) {
				object.properties.push(property)
			}
		}
		// fields need their own entry
		else if (field.kind === 'Field') {
			// look up the field
			const type = config.schema.getType(rootType) as graphql.GraphQLObjectType
			if (!type) {
				throw new Error('Could not find type')
			}
			const typeName = getRootType(type.getFields()[field.name.value].type).toString()

			const attributeName = field.alias?.value || field.name.value
			// make sure we include the attribute in the path
			const pathSoFar = path.concat(attributeName)

			// the object holding data for this field
			const fieldObj = AST.objectExpression([
				AST.objectProperty(AST.literal('type'), AST.stringLiteral(typeName)),
				AST.objectProperty(
					AST.literal('keyRaw'),
					AST.stringLiteral(fieldKey(printed, field))
				),
			])

			// is there an operation for this field
			const operationKey = pathSoFar.join(',')
			if (operations[operationKey]) {
				fieldObj.properties.push(
					AST.objectProperty(AST.literal('operations'), operations[operationKey])
				)
			}

			// get the name of the connection directive tagging this field
			const nameArg = field.directives
				?.find((directive) => directive.name.value === config.connectionDirective)
				?.arguments?.find((arg) => arg.name.value === 'name')
			let connection
			if (nameArg && nameArg.value.kind === 'StringValue') {
				connection = nameArg.value.value
				fieldObj.properties.push(
					AST.objectProperty(AST.literal('connection'), AST.stringLiteral(connection))
				)
			}

			// only add the field object if there are properties in it
			if (field.selectionSet) {
				const selectionObj = selection({
					config,
					rootType: typeName,
					selectionSet: field.selectionSet,
					operations,
					path: pathSoFar,
					printed,
					includeFragments,
					document,
				})
				fieldObj.properties.push(AST.objectProperty(AST.literal('fields'), selectionObj))
			}

			// any arguments on the connection field can act as a filter
			if (field.arguments?.length && connection) {
				fieldObj.properties.push(
					AST.objectProperty(
						AST.stringLiteral('filters'),
						AST.objectExpression(
							(field.arguments || []).flatMap((arg) => {
								// figure out the value to use
								let value
								let kind

								// the value of the arg is always going to be a

								if (arg.value.kind === graphql.Kind.INT) {
									value = AST.literal(parseInt(arg.value.value, 10))
									kind = 'Int'
								} else if (arg.value.kind === graphql.Kind.FLOAT) {
									value = AST.literal(parseFloat(arg.value.value))
									kind = 'Float'
								} else if (arg.value.kind === graphql.Kind.BOOLEAN) {
									value = AST.booleanLiteral(arg.value.value)
									kind = 'Boolean'
								} else if (arg.value.kind === graphql.Kind.VARIABLE) {
									value = AST.stringLiteral(arg.value.name.value)
									kind = 'Variable'
								} else if (arg.value.kind === graphql.Kind.STRING) {
									value = AST.stringLiteral(arg.value.value)
									kind = 'String'
								}

								if (!value || !kind) {
									return []
								}

								return [
									AST.objectProperty(
										AST.stringLiteral(arg.name.value),
										AST.objectExpression([
											AST.objectProperty(
												AST.literal('kind'),
												AST.stringLiteral(kind)
											),
											AST.objectProperty(AST.literal('value'), value),
										])
									),
								]
							})
						)
					)
				)
			}

			// add the field data we computed
			object.properties.push(AST.objectProperty(AST.stringLiteral(attributeName), fieldObj))
		}
	}

	return mergeSelections(config, object.properties as namedTypes.ObjectProperty[])
}

// different fragments can provide different selections of the same field
// we need to merge them into one single selection
function mergeSelections(
	config: Config,
	selections: namedTypes.ObjectProperty[]
): namedTypes.ObjectExpression {
	// we need to group together every field in the selection by its name
	const fields = selections.reduce<{
		[key: string]: namedTypes.ObjectProperty[]
	}>((prev, property) => {
		// the key
		const key = (property.key as namedTypes.StringLiteral).value
		return {
			...prev,
			[key]: (prev[key] || []).concat(property),
		}
	}, {})

	// build up an object
	const obj = AST.objectExpression([])

	// visit every set of properties
	for (const [attributeName, properties] of Object.entries(fields)) {
		// the type and key name should all be the same
		const types = properties.map<string>(
			(property) =>
				(property.value as namedTypes.ObjectExpression).properties.find(
					(prop) =>
						prop.type === 'ObjectProperty' &&
						prop.key.type === 'Literal' &&
						prop.key.value === 'type'
					// @ts-ignore
				)?.value.value
		)
		if (new Set(types).size !== 1) {
			throw new Error(
				'Encountered multiple types at the same field. Found ' +
					JSON.stringify([...new Set(types)])
			)
		}
		const keys = properties.map<string>(
			(property) =>
				(property.value as namedTypes.ObjectExpression).properties.find(
					(prop) =>
						prop.type === 'ObjectProperty' &&
						prop.key.type === 'Literal' &&
						prop.key.value === 'keyRaw'
					// @ts-ignore
				)?.value.value
		)
		if (new Set(keys).size !== 1) {
			throw new Error(
				'Encountered multiple keys at the same field. Found ' +
					JSON.stringify([...new Set(keys)])
			)
		}
		const connections = properties
			.map(
				(property) =>
					(property.value as namedTypes.ObjectExpression).properties.find(
						(prop) =>
							prop.type === 'ObjectProperty' &&
							prop.key.type === 'Literal' &&
							prop.key.value === 'connection'
						// @ts-ignore
					)?.value.value
			)
			.filter(Boolean)
		const operations = properties
			.flatMap<namedTypes.ArrayExpression['elements']>(
				(property) =>
					(property.value as namedTypes.ObjectExpression).properties.find(
						(prop) =>
							prop.type === 'ObjectProperty' &&
							prop.key.type === 'Literal' &&
							prop.key.value === 'operations'
						// @ts-ignore
					)?.value.elements
			)
			.filter(Boolean)

		const filters = properties
			.map((property) =>
				(property.value as namedTypes.ObjectExpression).properties.find(
					(prop) =>
						prop.type === 'ObjectProperty' &&
						prop.key.type === 'StringLiteral' &&
						prop.key.value === 'filters'
				)
			)
			.filter(Boolean)[0] as namedTypes.ObjectProperty

		// look at the first one in the list to check type
		const typeProperty = types[0]
		const key = keys[0]
		const connection = connections[0]

		// if the type is a scalar just add the first one and move on
		if (config.isSelectionScalar(typeProperty)) {
			obj.properties.push(properties[0])
			continue
		}

		if (attributeName === 'users') {
			operations
		}
		const fields = properties
			.map<namedTypes.ObjectExpression>(
				(property) =>
					(property.value as namedTypes.ObjectExpression).properties.find(
						(prop) =>
							prop.type === 'ObjectProperty' &&
							prop.key.type === 'Literal' &&
							prop.key.value === 'fields'
						// @ts-ignore
					)?.value
			)
			.flatMap((obj) => obj && obj.properties)
			.filter(Boolean)

		if (fields) {
			const fieldObj = AST.objectExpression([
				AST.objectProperty(AST.literal('type'), AST.stringLiteral(typeProperty)),
				AST.objectProperty(AST.literal('keyRaw'), AST.stringLiteral(key)),
			])

			// perform the merge
			const merged = mergeSelections(config, fields as namedTypes.ObjectProperty[])
			if (merged.properties.length > 0) {
				fieldObj.properties.push(AST.objectProperty(AST.literal('fields'), merged))
			}

			// add the connection field if its present
			if (connection) {
				fieldObj.properties.push(
					AST.objectProperty(AST.literal('connection'), AST.stringLiteral(connection))
				)
			}

			// if there are any operations
			if (operations.length > 0) {
				fieldObj.properties.push(
					AST.objectProperty(
						AST.literal('operations'),
						AST.arrayExpression(operations.reduce((prev, acc) => prev.concat(acc), []))
					)
				)
			}

			if (filters) {
				fieldObj.properties.push(filters)
			}

			obj.properties.push(AST.objectProperty(AST.literal(attributeName), fieldObj))
		}
	}

	// we're done
	return obj
}

// we need to generate a static key that we can use to index this field in the cache.
// this needs to be a unique-hash driven by the field's attribute and arguments
// returns the key for a specific field
function fieldKey(printed: string, field: graphql.FieldNode): string {
	// we're going to hash a field by creating a json object and adding it
	// to the attribute name
	const attributeName = field.alias?.value || field.name.value

	const argObj = (field.arguments || []).reduce<{ [key: string]: string }>((acc, arg) => {
		// the query already contains
		const start = arg.value.loc?.start
		const end = arg.value.loc?.end

		// if the argument is not in the query, life doesn't make sense
		if (!start || !end) {
			return acc
		}

		return {
			...acc,
			[arg.name.value]: printed.substring(start, end),
		}
	}, {})

	return Object.values(argObj).length > 0
		? `${attributeName}(${Object.entries(argObj)
				.map((entries) => entries.join(': '))
				.join(', ')})`
		: attributeName
}

// return the list of operations that are part of a mutation
function operationsByPath(
	config: Config,
	definition: graphql.OperationDefinitionNode,
	filterTypes: FilterMap
): { [path: string]: namedTypes.ArrayExpression } {
	// map the path in the response to the list of operations that treat it as the source
	const pathOperatons: { [path: string]: namedTypes.ArrayExpression } = {}

	// we need to look for three different things in the operation:
	// - insert fragments
	// - remove fragments
	// - delete directives
	//
	// note: for now, we're going to ignore the possibility that fragments
	// inside of the mutation could contain operations
	graphql.visit(definition, {
		FragmentSpread(node, _, __, ___, ancestors) {
			// if the fragment is not a connection operation, we don't care about it now
			if (!config.isConnectionFragment(node.name.value)) {
				return
			}

			// if this is the first time we've seen this path give us a home
			const path = ancestorKey(ancestors)
			if (!pathOperatons[path]) {
				pathOperatons[path] = AST.arrayExpression([])
			}

			const parents = [...ancestors] as (
				| graphql.FieldNode
				| graphql.InlineFragmentNode
				| graphql.FragmentDefinitionNode
				| graphql.OperationDefinitionNode
				| graphql.SelectionSetNode
			)[]
			parents.reverse()

			// add the operation object to the list
			pathOperatons[path].elements.push(
				operationObject({
					config,
					connectionName: config.connectionNameFromFragment(node.name.value),
					operationKind: config.connectionOperationFromFragment(node.name.value),
					info: operationInfo(config, node),
					type: getTypeFromAncestors(config.schema, parents).name,
					filterTypes,
				})
			)
		},
		Directive(node, _, __, ___, ancestors) {
			// we only care about delete directives
			if (!config.isDeleteDirective(node.name.value)) {
				return
			}

			// if this is the first time we've seen this path give us a home
			const path = ancestorKey(ancestors)
			if (!pathOperatons[path]) {
				pathOperatons[path] = AST.arrayExpression([])
			}

			// add the operation object to the list
			pathOperatons[path].elements.push(
				operationObject({
					config,
					connectionName: `${node.name.value}`,
					operationKind: 'delete',
					info: operationInfo(
						config,
						ancestors[ancestors.length - 1] as graphql.FieldNode
					),
					type: config.connectionNameFromDirective(node.name.value),
					filterTypes,
				})
			)
		},
	})

	return pathOperatons
}

function operationObject({
	config,
	connectionName,
	operationKind,
	info,
	type,
	filterTypes,
}: {
	config: Config
	connectionName: string
	operationKind: string
	info: OperationInfo
	type: string
	filterTypes: FilterMap
}) {
	const operation = AST.objectExpression([
		AST.objectProperty(AST.literal('action'), AST.stringLiteral(operationKind)),
	])

	// delete doesn't have a target
	if (operationKind !== 'delete') {
		operation.properties.push(
			AST.objectProperty(AST.literal('connection'), AST.stringLiteral(connectionName))
		)
	}

	// add the target type to delete operations
	if (operationKind === 'delete' && type) {
		operation.properties.push(AST.objectProperty(AST.literal('type'), AST.stringLiteral(type)))
	}

	// only add the position argument if we are inserting something
	if (operationKind === 'insert') {
		operation.properties.push(
			AST.objectProperty(AST.literal('position'), AST.stringLiteral(info.position || 'last'))
		)
	}

	// if there is a parent id
	if (info.parentID) {
		// add it to the object
		operation.properties.push(
			AST.objectProperty(
				AST.literal('parentID'),
				AST.objectExpression([
					AST.objectProperty(AST.literal('kind'), AST.stringLiteral(info.parentID.kind)),
					AST.objectProperty(
						AST.literal('value'),
						AST.stringLiteral(info.parentID.value)
					),
				])
			)
		)
	}

	// if there is a conditional
	if (info.when) {
		// build up the when object
		const when = AST.objectExpression([])

		// if there is a must
		if (info.when.must) {
			when.properties.push(
				AST.objectProperty(
					AST.literal('must'),
					filterAST(filterTypes, connectionName, info.when.must)
				)
			)
		}

		// if there is a must_not
		if (info.when.must_not) {
			when.properties.push(
				AST.objectProperty(
					AST.literal('must_not'),
					filterAST(filterTypes, connectionName, info.when.must_not)
				)
			)
		}

		// add it to the object
		operation.properties.push(AST.objectProperty(AST.literal('when'), when))
	}

	return operation
}

type OperationInfo = {
	position: string
	parentID?: {
		value: string
		kind: string
	}
	when?: ConnectionWhen
}

function operationInfo(config: Config, selection: graphql.SelectionNode): OperationInfo {
	// look at the directives applies to the spread for meta data about the mutation
	let parentID
	let parentKind: 'Variable' | 'String' = 'String'

	let position: MutationOperation['position'] = 'last'
	let operationWhen: MutationOperation['when'] | undefined

	const internalDirectives = selection.directives?.filter((directive) =>
		config.isInternalDirective(directive)
	)
	if (internalDirectives && internalDirectives.length > 0) {
		// is prepend applied?
		const prepend = internalDirectives.find(
			({ name }) => name.value === config.connectionPrependDirective
		)
		// is append applied?
		const append = internalDirectives.find(
			({ name }) => name.value === config.connectionAppendDirective
		)
		// is when applied?
		const when = internalDirectives.find(({ name }) => name.value === 'when')
		// is when_not applied?
		const when_not = internalDirectives.find(({ name }) => name.value === 'when_not')
		// look for the parentID directive
		let parent = internalDirectives.find(
			({ name }) => name.value === config.connectionParentDirective
		)

		// if both are applied, there's a problem
		if (append && prepend) {
			throw new Error('WRAP THIS IN A HOUDINI ERROR. you have both applied')
		}
		position = prepend ? 'first' : 'last'

		// the parent ID can be provided a few ways, either as an argument to the prepend
		// and append directives or with the parentID directive.

		let parentIDArg = parent?.arguments?.find((argument) => argument.name.value === 'value')
		// if there is no parent id argument, it could have been provided by one of the connection directives
		if (!parentIDArg) {
			parentIDArg = (append || prepend)?.arguments?.find(
				({ name }) => name.value === config.connectionDirectiveParentIDArg
			)
		}

		if (parentIDArg) {
			// if the argument is a string
			if (parentIDArg.value.kind === 'StringValue') {
				// use its value
				parentID = parentIDArg.value.value
				parentKind = 'String'
			} else if (parentIDArg.value.kind === 'Variable') {
				parentKind = 'Variable'
				parentID = parentIDArg.value.name.value
			}
		}

		// look for a when arguments on the operation directives
		const whenArg = (append || prepend)?.arguments?.find(({ name }) => name.value === 'when')
		// look for a when_not condition on the operation
		const whenNotArg = (append || prepend)?.arguments?.find(
			({ name }) => name.value === 'when_not'
		)

		for (const [i, arg] of [whenArg, whenNotArg].entries()) {
			// we may not have the argument
			if (!arg || arg.value.kind !== 'ObjectValue') {
				continue
			}

			//which are we looking at
			const which = i ? 'must_not' : 'must'
			// build up all of the values into a single object
			const key = arg.value.fields.find(({ name, value }) => name.value === 'argument')?.value
			const value = arg.value.fields.find(({ name }) => name.value === 'value')

			// make sure we got a string for the key
			if (key?.kind !== 'StringValue' || !value || value.value.kind !== 'StringValue') {
				throw new Error('Key and Value must be strings')
			}

			// make sure we have a place to record the when condition
			if (!operationWhen) {
				operationWhen = {}
			}

			// the kind of `value` is always going to be a string because the directive
			// can only take one type as its argument so we'll worry about parsing when
			// generating the artifact
			operationWhen[which] = {
				[key.value]: value.value.value,
			}
		}

		// look at the when and when_not directives
		for (const [i, directive] of [when, when_not].entries()) {
			// we may not have the directive applied
			if (!directive) {
				continue
			}
			//which are we looking at
			const which = i ? 'must_not' : 'must'

			// look for the argument field
			const key = directive.arguments?.find(({ name }) => name.value === 'argument')
			const value = directive.arguments?.find(({ name }) => name.value === 'value')

			// make sure we got a string for the key
			if (key?.value.kind !== 'StringValue' || !value || value.value.kind !== 'StringValue') {
				throw new Error('Key and Value must be strings')
			}

			// make sure we have a place to record the when condition
			if (!operationWhen) {
				operationWhen = {}
			}

			// the kind of `value` is always going to be a string because the directive
			// can only take one type as its argument so we'll worry about parsing when
			// generating the patches
			operationWhen[which] = {
				[key.value.value]: value.value.value,
			}
		}
	}

	return {
		parentID: parentID
			? {
					value: parentID,
					kind: parentKind,
			  }
			: undefined,
		position,
		when: operationWhen,
	}
}

function filterAST(
	filterTypes: FilterMap,
	connectionName: string,
	filter: ConnectionWhen['must']
): namedTypes.ObjectExpression {
	if (!filter) {
		return AST.objectExpression([])
	}

	// build up the object
	return AST.objectExpression(
		Object.entries(filter).map(([key, value]) => {
			// look up the key in the type map
			const type = filterTypes[connectionName] && filterTypes[connectionName][key]
			if (!type) {
				throw new Error(
					`It looks like "${key}" is an invalid filter for connection ${connectionName}`
				)
			}

			let literal
			if (type === 'String') {
				literal = AST.stringLiteral(value as string)
			} else if (type === 'Boolean') {
				literal = AST.booleanLiteral(value === 'true')
			} else if (type === 'Float') {
				literal = AST.numericLiteral(parseFloat(value as string))
			} else if (type === 'Int') {
				literal = AST.numericLiteral(parseInt(value as string, 10))
			} else {
				throw new Error('Could not figure out filter value with type: ' + type)
			}
			return AST.objectProperty(AST.literal(key), literal)
		})
	)
}

// TODO: find a way to reference the actual type for ancestors, using any as escape hatch
function ancestorKey(ancestors: any): string {
	return (
		ancestors
			.filter(
				// @ts-ignore
				(entry) => !Array.isArray(entry) && entry.kind === 'Field'
			)
			// @ts-ignore
			.map((field) => field.name.value)
			.join(',')
	)
}
type FilterMap = {
	[connectionName: string]: {
		[filterName: string]: 'String' | 'Float' | 'Int' | 'Boolean'
	}
}
