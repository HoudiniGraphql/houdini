import * as graphql from 'graphql'
import { test, expect, describe } from 'vitest'

import { testConfig } from '../../test'
import { TypeWrapper, unwrapType } from './graphql'

describe('unwrapType', () => {
	test('list of lists', function () {
		const type: graphql.TypeNode = {
			kind: graphql.Kind.LIST_TYPE,
			type: {
				kind: graphql.Kind.NON_NULL_TYPE,
				type: {
					kind: graphql.Kind.NAMED_TYPE,
					name: {
						kind: graphql.Kind.NAME,
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
