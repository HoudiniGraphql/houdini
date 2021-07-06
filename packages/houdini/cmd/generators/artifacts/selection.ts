// externals
import { Config, getRootType } from 'houdini-common'
import * as graphql from 'graphql'
import * as recast from 'recast'
import { namedTypes } from 'ast-types/gen/namedTypes'
// locals
import fieldKey from './fieldKey'

const AST = recast.types.builders

export default function selection({
	config,
	rootType,
	selectionSet,
	operations,
	path = [],
	includeFragments,
	document,
}: {
	config: Config
	rootType: string
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
				rootType: field.typeCondition?.name.value || rootType,
				operations,
				selectionSet: field.selectionSet,
				path,
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
			const fieldObj = AST.objectExpression([
				AST.objectProperty(AST.literal('type'), AST.stringLiteral(typeName)),
				AST.objectProperty(AST.literal('keyRaw'), AST.stringLiteral(fieldKey(field))),
			])

			// is there an operation for this field
			const operationKey = pathSoFar.join(',')
			if (operations[operationKey]) {
				fieldObj.properties.push(
					AST.objectProperty(AST.literal('operations'), operations[operationKey])
				)
			}

			// get the name of the list directive tagging this field
			const nameArg = field.directives
				?.find((directive) => directive.name.value === config.listDirective)
				?.arguments?.find((arg) => arg.name.value === 'name')
			let list
			if (nameArg && nameArg.value.kind === 'StringValue') {
				list = nameArg.value.value
				fieldObj.properties.push(
					AST.objectProperty(AST.literal('connection'), AST.stringLiteral(list))
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
					includeFragments,
					document,
				})
				fieldObj.properties.push(AST.objectProperty(AST.literal('fields'), selectionObj))
			}

			// any arguments on the list field can act as a filter
			if (field.arguments?.length && list) {
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
			// if we are looking at an interface
			if (graphql.isInterfaceType(fieldType) || graphql.isUnionType(fieldType)) {
				fieldObj.properties.push(
					AST.objectProperty(AST.stringLiteral('abstract'), AST.booleanLiteral(true))
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
		const lists = properties
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

		const abstractFlags = properties
			.map(
				(property) =>
					(property.value as namedTypes.ObjectExpression).properties.find(
						(prop) =>
							prop.type === 'ObjectProperty' &&
							prop.key.type === 'StringLiteral' &&
							prop.key.value === 'abstract'
						// @ts-ignore
					)?.value.value
			)
			.filter(Boolean)

		// look at the first one in the list to check type
		const typeProperty = types[0]
		const key = keys[0]
		const list = lists[0]
		const abstractFlag = abstractFlags[0]

		// if the type is a scalar just add the first one and move on
		if (config.isSelectionScalar(typeProperty)) {
			obj.properties.push(properties[0])
			continue
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

			// add the list field if its present
			if (list) {
				fieldObj.properties.push(
					AST.objectProperty(AST.literal('connection'), AST.stringLiteral(list))
				)
			}

			// if its marked as a list
			if (abstractFlag) {
				fieldObj.properties.push(
					AST.objectProperty(AST.literal('abstract'), AST.booleanLiteral(abstractFlag))
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
