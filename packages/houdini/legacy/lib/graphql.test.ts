import * as graphql from 'graphql'
import { test, expect, describe } from 'vitest'

import { testConfig } from '../test'
import { TypeWrapper, unwrapType } from './graphql'

describe('unwrapType', () => {
	test('nullable list of non-null', function () {
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

	test('non-null list of non-null', function () {
		const type: graphql.TypeNode = {
			kind: graphql.Kind.NON_NULL_TYPE,
			type: {
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
			},
		}

		const unwrapped = unwrapType(testConfig(), type)

		// make sure we can get the inner type
		expect(unwrapped.type.name).toEqual('User')

		// and that we have the correct set of wrappers
		expect(unwrapped.wrappers).toEqual([
			TypeWrapper.NonNull,
			TypeWrapper.List,
			TypeWrapper.NonNull,
		])
	})

	test('non-null', function () {
		const type: graphql.TypeNode = {
			kind: graphql.Kind.NON_NULL_TYPE,
			type: {
				kind: graphql.Kind.NAMED_TYPE,
				name: {
					kind: graphql.Kind.NAME,
					value: 'User',
				},
			},
		}

		const unwrapped = unwrapType(testConfig(), type)

		// make sure we can get the inner type
		expect(unwrapped.type.name).toEqual('User')

		// and that we have the correct set of wrappers
		expect(unwrapped.wrappers).toEqual([TypeWrapper.NonNull])
	})

	test('nullable', function () {
		const type: graphql.TypeNode = {
			kind: graphql.Kind.NAMED_TYPE,
			name: {
				kind: graphql.Kind.NAME,
				value: 'User',
			},
		}

		const unwrapped = unwrapType(testConfig(), type)

		// make sure we can get the inner type
		expect(unwrapped.type.name).toEqual('User')

		// and that we have the correct set of wrappers
		expect(unwrapped.wrappers).toEqual([TypeWrapper.Nullable])
	})

	test('nullable list of nullable', function () {
		const type: graphql.TypeNode = {
			kind: graphql.Kind.LIST_TYPE,
			type: {
				kind: graphql.Kind.NAMED_TYPE,
				name: {
					kind: graphql.Kind.NAME,
					value: 'User',
				},
			},
		}

		const unwrapped = unwrapType(testConfig(), type)

		// make sure we can get the inner type
		expect(unwrapped.type.name).toEqual('User')

		// and that we have the correct set of wrappers
		expect(unwrapped.wrappers).toEqual([
			TypeWrapper.Nullable,
			TypeWrapper.List,
			TypeWrapper.Nullable,
		])
	})

	test('non-null list of nullable', function () {
		const type: graphql.TypeNode = {
			kind: graphql.Kind.NON_NULL_TYPE,
			type: {
				kind: graphql.Kind.LIST_TYPE,
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
			TypeWrapper.Nullable,
			TypeWrapper.List,
			TypeWrapper.NonNull,
		])
	})
})
