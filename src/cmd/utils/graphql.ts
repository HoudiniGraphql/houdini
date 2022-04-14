import * as graphql from 'graphql'
import { Config } from '../../common'

export function unwrapType(
	config: Config,
	type: any,
	wrappers: TypeWrapper[] = []
): { type: graphql.GraphQLNamedType; wrappers: TypeWrapper[] } {
	// if we are looking at a non null type
	if (type.kind === 'NonNullType') {
		return unwrapType(config, type.type, [TypeWrapper.NonNull, ...wrappers])
	}
	if (type instanceof graphql.GraphQLNonNull) {
		return unwrapType(config, type.ofType, [TypeWrapper.NonNull, ...wrappers])
	}

	// if the last thing we added was not a non-null indicator
	if (wrappers[0] !== TypeWrapper.NonNull) {
		// add the nullable mark
		wrappers.unshift(TypeWrapper.Nullable)
	}

	if (type.kind === 'ListType') {
		return unwrapType(config, type.type, [TypeWrapper.List, ...wrappers])
	}
	if (type instanceof graphql.GraphQLList) {
		return unwrapType(config, type.ofType, [TypeWrapper.List, ...wrappers])
	}

	// get the named type
	const namedType = config.schema.getType(type.name.value || type.name)
	if (!namedType) {
		throw new Error('Could not unwrap type: ' + JSON.stringify(type))
	}

	// don't add any wrappers
	return { type: namedType, wrappers }
}

export function wrapType({
	type,
	wrappers,
}: {
	type: graphql.GraphQLNamedType
	wrappers: TypeWrapper[]
}): graphql.TypeNode {
	const head = wrappers[0]
	const tail = wrappers.slice(1)

	let kind: graphql.TypeNode['kind'] = 'NamedType'
	if (head === TypeWrapper.List) {
		kind = 'ListType'
	} else if (head === TypeWrapper.NonNull) {
		kind = 'NonNullType'
	}

	if (kind === 'NamedType') {
		return {
			kind,
			name: {
				kind: 'Name',
				value: type.name,
			},
		}
	}

	return {
		kind,
		// @ts-ignore
		type: wrapType({ type, wrappers: tail }),
	}
}

export enum TypeWrapper {
	Nullable = 'Nullable',
	List = 'List',
	NonNull = 'NonNull',
}
