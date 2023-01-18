import * as graphql from 'graphql'

import type { Config } from '../../lib'

export const objectIdentificationSelection = (config: Config, type: graphql.GraphQLNamedType) => {
	return config.keyFieldsForType(type.name).map((key) => {
		return {
			kind: graphql.Kind.FIELD,
			name: {
				kind: graphql.Kind.NAME,
				value: key,
			},
		} as graphql.SelectionNode
	})
}
