import * as graphql from 'graphql'

import { GraphQLValue } from '../../lib'

export function stripLoc<
	T extends
		| GraphQLValue
		| graphql.ValueNode
		| readonly graphql.ArgumentNode[]
		| graphql.ArgumentNode
>(value: T): T {
	if (typeof value !== 'object' || value === null) {
		return value
	}

	if (Array.isArray(value)) {
		// @ts-expect-error
		return value.map(stripLoc)
	}

	// if the value is an object, remove the loc key
	return Object.fromEntries(
		Object.entries(value).map(([key, fieldValue]) => {
			if (key === 'loc') {
				return []
			}

			return [key, stripLoc(fieldValue)]
		})
	)
}
