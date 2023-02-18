import * as graphql from 'graphql'
import { test, expect, describe } from 'vitest'

import { flattenSelections } from '../codegen/utils/flattenSelections'
import { testConfig } from '../test'
import { TypeWrapper, unwrapType } from './graphql'

const config = testConfig({ defaultFragmentMasking: 'disable' })

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

const fragmentDefinitions = (
	graphql.parse(`
	fragment Foo on User {
		id
	}
`).definitions as graphql.FragmentDefinitionNode[]
).reduce(
	(acc, defn) => ({
		...acc,
		[defn.name.value]: defn,
	}),
	{}
)

function getSelections(doc: string): readonly graphql.SelectionNode[] {
	return (graphql.parse(doc).definitions[0] as graphql.OperationDefinitionNode).selectionSet
		.selections
}

function testFlatten(doc: string, applyFragments: boolean = true): graphql.OperationDefinitionNode {
	const flat = flattenSelections({
		config,
		applyFragments,
		filepath: '',
		fragmentDefinitions,
		selections: getSelections(doc),
	})

	return {
		kind: 'OperationDefinition',
		operation: 'query',
		selectionSet: { kind: 'SelectionSet', selections: flat },
	}
}

describe('flattenSelection', function () {
	test('applies fragment definitions', function () {
		expect(
			testFlatten(`
				{
					user {
						...Foo
					}
				}
			`)
		).toMatchInlineSnapshot(`
			{
			  user {
			    ... on User {
			      id
			    }
			    ...Foo
			  }
			}
		`)
	})

	test('merges field selections', function () {
		expect(
			testFlatten(`
				{
					user {
						id
					}
					user {
						name
					}
				}
			`)
		).toMatchInlineSnapshot(`
			{
			  user {
			    id
			    name
			  }
			}
		`)
	})

	test('flattens nested inline fragments', function () {
		expect(
			testFlatten(`
				{
					friends {
						... on Friend {
							name
							... on User {
								id
							}
							... on Ghost {
								id
							}
							... on Cat {
								id
							}
						}
						... on Cat {
							name
						}
					}
				}
			`)
		).toMatchInlineSnapshot(`
			{
			  friends {
			    ... on Friend {
			      name
			    }
			    ... on User {
			      id
			    }
			    ... on Ghost {
			      id
			    }
			    ... on Cat {
			      id
			      name
			    }
			  }
			}
		`)
	})

	test('flattens referenced fragments', function () {
		expect(
			testFlatten(
				`
				{
					friends {
						... on Friend {
							name
							... Foo
						}
					}
				}
			`,
				false
			)
		).toMatchInlineSnapshot(`
			{
			  friends {
			    ... on Friend {
			      name
			    }
			    ...Foo
			  }
			}
		`)
	})
})
