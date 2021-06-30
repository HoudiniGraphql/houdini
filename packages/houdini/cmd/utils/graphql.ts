import * as graphql from 'graphql'
import { Config } from 'houdini-common'

export function unwrapType(
	config: Config,
	source: any
): { type: graphql.GraphQLNamedType; list: boolean; nonNull: boolean; nullable: boolean } {
	// build a reference we will unwrap
	let type = source
	// start unwrapping non-nulls and lists (we'll wrap it back up before we return)
	let nonNull = false
	if (type.kind === 'NonNullType') {
		type = type.type
		nonNull = true
	}
	if (type instanceof graphql.GraphQLNonNull) {
		nonNull = true
		type = type.ofType
	}
	let list = false
	if (type.kind === 'ListType') {
		type = type.type
		list = true
	}
	if (type instanceof graphql.GraphQLList) {
		type = type.ofType
		list = true
	}
	let innerNonNull = false
	if (type.kind === 'NonNullType') {
		type = type.type
		innerNonNull = true
	}
	if (type instanceof graphql.GraphQLNonNull) {
		type = type.ofType
		innerNonNull = true
	}

	// get the named type
	const namedType = config.schema.getType(type.name.value || type.name)
	if (!namedType) {
		throw new Error('Could not unwrap type: ' + source)
	}

	return {
		type: namedType,
		nullable: nonNull,
		nonNull: innerNonNull,
		list,
	}
}
