import * as graphql from 'graphql'
import { Kind as GraphqlKinds } from 'graphql/language'

export const isListType = (type: graphql.TypeNode) =>
	type.kind === GraphqlKinds.LIST_TYPE ||
	(type.kind === GraphqlKinds.NON_NULL_TYPE && type.type.kind === GraphqlKinds.LIST_TYPE)

export const typeName = (type: graphql.TypeNode): string =>
	// if we are looking at somethin that's not a list or non-null value
	type.kind !== GraphqlKinds.LIST_TYPE && type.kind !== GraphqlKinds.NON_NULL_TYPE
		? // return the type name
		  type.name.value
		: // it is either a list or non-null value, so go one level deeper
		  typeName(type.type)

export const getNamedType = (
	schema: graphql.GraphQLSchema,
	name: string
): graphql.GraphQLObjectType => {
	const type = schema.getType(name)
	if (!type) {
		throw new Error('Could not find type for ' + name)
	}

	return type as graphql.GraphQLObjectType
}
