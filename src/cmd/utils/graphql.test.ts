import * as graphql from 'graphql'
import { testConfig } from '~/common'

import { TypeWrapper, unwrapType } from './graphql'

describe('unwrapType', () => {
	test('list of lists', function () {
		const type: graphql.TypeNode = {
			kind: 'ListType',
			type: {
				kind: 'NonNullType',
				type: {
					kind: 'NamedType',
					name: {
						kind: 'Name',
						value: 'User',
					},
				},
			},
		}

		const unwrapped = unwrapType(testConfig(), type)

		// make sure we can get the inner type
		expect(unwrapped.type.name).toEqual('User')

		// and that we have the correct set of wrappers
		expect(unwrapped.wrappers).toEqual([
			TypeWrapper.NonNull,
			TypeWrapper.List,
			TypeWrapper.Nullable,
		])
	})
})
