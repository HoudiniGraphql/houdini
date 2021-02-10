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
	const fieldMap = graphql.isNonNullType(rootType)
		? rootType.ofType.getFields()
		: rootType.getFields()

	const field = fieldMap[selectionName]

	const fieldType = (graphql.getNamedType(field.type) as unknown) as graphql.GraphQLNamedType
	const fieldTypeName = fieldType.name

	if (!field || !fieldType) {
		throw new Error(
			`Could not find type information for field ${rootType.toString()}.${selectionName} ${field} ${fieldType}`
		)
	}
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

// return if the type is a list or not
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
