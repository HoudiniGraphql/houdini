import * as graphql from 'graphql'
import crypto from 'crypto'

// look up the selection type info
export function selectionTypeInfo(
	schema: graphql.GraphQLSchema,
	rootType: graphql.GraphQLObjectType<any, any>,
	selection: graphql.SelectionNode
): { field: graphql.GraphQLField<any, any>; type: graphql.GraphQLNamedType } {
	// the field we are looking at
	const selectionName = (selection as graphql.FieldNode).name.value
	const responseInfo = graphql.isNonNullType(rootType)
		? rootType.ofType.getFields()
		: rootType.getFields()

	const field = responseInfo[selectionName]

	if (!field) {
		throw new Error(
			`Could not find type information for field ${rootType.toString()}.${selectionName} ${field}`
		)
	}
	const fieldType = (graphql.getNamedType(field.type) as unknown) as graphql.GraphQLNamedType
	if (!fieldType) {
		throw new Error(
			`Could not find type information for field ${rootType.toString()}.${selectionName} ${field}`
		)
	}

	const fieldTypeName = fieldType.name

	// and the actual object type that it refers to
	// @ts-ignore
	const selectionType = schema.getType(fieldTypeName) as graphql.GraphQLObjectType
	if (!selectionType) {
		throw new Error('Could not find type for ' + fieldTypeName)
	}

	return { field, type: selectionType }
}

// return if the type is a list or not
export function isListType(type: graphql.GraphQLType): boolean {
	// if the type is non-null, unwrap and check again
	if (graphql.isNonNullType(type)) {
		return isListType((type as graphql.GraphQLNonNull<any>).ofType)
	}

	return graphql.isListType(type)
}

// return if the type is a scalar or not
export function isScalarType(type: graphql.GraphQLType): boolean {
	// if the type is non-null, unwrap and check again
	if (graphql.isNonNullType(type)) {
		return isScalarType((type as graphql.GraphQLNonNull<any>).ofType)
	}

	return graphql.isScalarType(type)
}

export function isObjectType(type: graphql.GraphQLType): boolean {
	// if the type is non-null, unwrap and check again
	if (graphql.isNonNullType(type)) {
		return isObjectType((type as graphql.GraphQLNonNull<any>).ofType)
	}

	return graphql.isObjectType(type)
}

export function getRootType(type: graphql.GraphQLType): graphql.GraphQLType {
	// if the type is non-null, unwrap and go again
	if (graphql.isNonNullType(type)) {
		return getRootType((type as graphql.GraphQLNonNull<any>).ofType)
	}

	// if the type is non-null, unwrap and go again
	if (graphql.isListType(type)) {
		return getRootType((type as graphql.GraphQLList<any>).ofType)
	}

	// we've unwrapped everythings
	return type
}

export function hashDocument(document: string | graphql.DocumentNode): string {
	// if we were given an AST document, print it first
	const docString = typeof document === 'string' ? document : graphql.print(document)

	// hash the string
	return crypto.createHash('md5').update(docString).digest('hex')
}

export function getTypeFromAncestors(
	schema: graphql.GraphQLSchema,
	ancestors: (
		| graphql.OperationDefinitionNode
		| graphql.FragmentDefinitionNode
		| graphql.SelectionNode
		| graphql.SelectionSetNode
	)[]
): graphql.GraphQLNamedType {
	// get the front node
	let head = ancestors.shift()
	// if it was a list, skip it
	if (Array.isArray(head)) {
		return getTypeFromAncestors(schema, ancestors)
	}

	if (!head) {
		throw new Error('Could not figure out type of field where directive is applied')
	}

	// if we are at the top of the definition stack
	if (head.kind === 'OperationDefinition') {
		// grab the appropriate
		const operationType = {
			query: schema.getQueryType(),
			mutation: schema.getMutationType(),
			subscription: schema.getSubscriptionType(),
		}[head.operation]

		if (!operationType) {
			throw new Error('Could not find operation type')
		}
		return operationType
	}

	if (head.kind === 'FragmentDefinition') {
		// look up the type condition in the schema
		const result = schema.getType(head.typeCondition.name.value)
		if (!result) {
			throw new Error(
				`Could not find definition for ${head.typeCondition.name} in the schema`
			)
		}

		// we're done here
		return result
	}

	// if we are looking at a fragment spread there is a serious problem
	if (head.kind === 'FragmentSpread') {
		throw new Error('How the hell did this happen?')
	}

	// grab our parent type
	const parent = getTypeFromAncestors(schema, ancestors)

	// if the parent type is not an object type, we have a problem
	if (!(parent instanceof graphql.GraphQLObjectType)) {
		throw new Error('parent type was not an object')
	}

	// we are looking at an inline fragment or selection select
	if (head.kind === 'InlineFragment' || head.kind === 'SelectionSet') {
		// our type is our parent's type
		return parent
	}

	// we are looking at a field so we can just access the field map of the parent type
	const field = parent.getFields()[head.name.value]
	if (!field) {
		throw new Error(`Could not find definition of ${head.name.value} in ${parent.toString()}`)
	}

	return getRootType(field.type) as graphql.GraphQLNamedType
}
