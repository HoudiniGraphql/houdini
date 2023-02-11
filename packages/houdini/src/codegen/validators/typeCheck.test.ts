import type * as graphql from 'graphql'
import { test, expect, describe } from 'vitest'

import type { Config } from '../../lib'
import type { Document } from '../../lib/types'
import { pipelineTest, testConfig } from '../../test'
import { valueIsType } from './typeCheck'

// since generation will catch a lot of these errors for us, the goal of these tests is to make sure
// errors are caught __before__ we get to the generation stage. This means that our failure tests
// need to look for multiple errors thrown at once

const table: Row[] = [
	{
		title: 'allows documents that satisfy schema',
		pass: true,
		documents: [
			`
                query QueryA {
                    version
                }
            `,
		],
	},
	{
		title: 'allows documents spread across multiple sources',
		pass: true,
		documents: [
			`
                query QueryA {
                    user {
                        ...FragmentA
                    }
                }
            `,
			`
                fragment FragmentA on User {
                    firstName
                }
            `,
		],
	},
	{
		title: 'unknown types in fragments',
		pass: false,
		documents: [
			`
                fragment FragmentA on Foo {
                    bar
                }
            `,
			`
                fragment FragmentA2 on Foo {
                    bar
                }
            `,
		],
	},
	{
		title: 'unknown fields in queries',
		pass: false,
		documents: [
			`
                query one {
                    user {
                        foo
                    }
                }
            `,
			`
                query two {
                    user {
                        foo
                    }
                }
            `,
		],
	},
	{
		title: '@list on query',
		pass: true,
		documents: [
			`
                query TestQuery {
					user {
						friends @list(name: "Friends") {
							id
						}
					}
                }
            `,
			`
                mutation MutationM {
					addFriend {
						...Friends_insert
					}
                }
            `,
		],
	},
	{
		title: '@list on query on field that doesn t exist',
		pass: false,
		documents: [
			`
                query TestQuery {
					user {
						friends_NOT_EXISTING_FIELD @list(name: "Friends") {
							id
						}
					}
                }
            `,
		],
		check: (e: any) => {
			expect(e.message).toMatchInlineSnapshot(
				'"Could not find definition of friends_NOT_EXISTING_FIELD in User"'
			)
		},
	},
	{
		title: 'no @parentID @allLists on _insert, but defaultListTarget',
		pass: true,
		documents: [
			`query TestQuery {
					user {
						friends {
							friends @list(name: "Friends") {
								id
							}
						}
					}
      }`,
			`mutation MutationM1 {
					addFriend {
						...Friends_insert
					}
      }`,
			`mutation MutationM2 {
				addFriend {
					...Friends_insert
				}
		}`,
		],
		check(docs) {},
		partial_config: { defaultListTarget: 'all' },
	},
	{
		title: '@parentID @allLists on _insert',
		pass: false,
		documents: [
			`query TestQuery {
					user {
						friends {
							friends @list(name: "Friends") {
								id
							}
						}
					}
			}`,
			`mutation MutationM1 {
				addFriend {
					...Friends_insert @parentID(value: "1") @allLists
				}
			}`,
			`mutation MutationM2 {
				addFriend {
					...Friends_insert @parentID(value: "1") @allLists
				}
			}`,
		],
	},
	{
		title: '@mask_enable @mask_disable on fragment',
		pass: false,
		documents: [
			`fragment FooA on Query {
				users(stringValue: $name) { id }
			}`,
			`fragment FooB on Query {
				users(stringValue: $name) { id }
			}`,
			`query TestQuery {
					...FooA @mask_enable @mask_disable
					...FooB @mask_enable @mask_disable
			}`,
		],
	},
	{
		title: '@list name must be unique',
		pass: false,
		documents: [
			`
                query TestQuery1 {
					user {
						friends {
							friends @list(name: "Friends") {
								id
							}
						}
					}
                }
            `,
			`
				query TestQuery2 {
					user {
						friends {
							friends @list(name: "Friends") {
								id
							}
						}
					}
				}
            `,
			`
				query TestQuery2 {
					user {
						friends {
							friends @list(name: "Friends") {
								id
							}
						}
					}
				}
            `,
		],
	},
	{
		title: '@list with parentID as variable on query',
		pass: true,
		documents: [
			`query TestQuery {
					user {
						friends {
							friends @list(name: "Friends") {
								id
							}
						}
					}
        }
            `,
			`mutation MutationM1($parentID: ID!) {
					addFriend {
						...Friends_insert @prepend @parentID(value: $parentID)
					}
				}`,
			`mutation MutationM2($parentID: ID!) {
					addFriend {
						...Friends_insert @prepend @parentID(value: $parentID)
					}
				}`,
		],
	},
	{
		title: 'deprecated usage of parentID in append and prepend',
		pass: false,
		documents: [
			`query TestQuery {
					user {
						friends {
							friends @list(name: "Friends") {
								id
							}
						}
					}
        }
            `,
			`mutation MutationM1($parentID: ID!) {
					addFriend {
						...Friends_insert @append(parentID: $parentID)
					}
				}`,
			`mutation MutationM2($parentID: ID!) {
					addFriend {
						...Friends_insert @prepend(parentID: $parentID)
					}
				}`,
		],
		nb_of_fail: 4,
	},
	{
		title: '@list without parentID on fragment',
		pass: false,
		documents: [
			`
                fragment FragmentA on User {
					friends @list(name: "Friends") {
						firstName
					}
                }
            `,
			`
                mutation Mutation1 {
					addFriend {
						...Friends_insert
					}
                }
            `,
			`
                mutation Mutation2 {
					addFriend {
						...Friends_insert
					}
                }
            `,
		],
	},
	{
		title: '@list prepend on query no id',
		pass: false,
		documents: [
			`
                query UserFriends {
					user {
						friends {
							friends @list(name: "Friends") {
								id
							}
						}
					}
                }
            `,
			`
                mutation Mutation1 {
					addFriend {
						...Friends_insert @prepend
					}
                }
            `,
			`
                mutation Mutation2 {
					addFriend {
						...Friends_insert @prepend
					}
                }
            `,
		],
	},
	{
		title: '@list append on query no id',
		pass: false,
		documents: [
			`
                query UserFriends {
					user {
						friends {
							friends @list(name: "Friends") {
								id
							}
						}
					}
                }
            `,
			`
                mutation Mutation1 {
					addFriend {
						...Friends_insert @append
					}
                }
            `,
			`
                mutation Mutation2 {
					addFriend {
						...Friends_insert @append
					}
                }
            `,
		],
	},
	{
		title: '@list no directive on query',
		pass: false,
		documents: [
			`
                query UserFriends {
					user {
						friends {
							friends @list(name: "Friends") {
								id
							}
						}
					}
                }
            `,
			`
                mutation Mutation1 {
					addFriend {
						...Friends_insert
					}
                }
            `,
			`
                mutation Mutation2 {
					addFriend {
						...Friends_insert
					}
                }
            `,
		],
	},
	{
		title: 'unknown fragments',
		pass: false,
		documents: [
			`
				query Foo {
					user {
						...UserFragment
					}
				}
			`,
			`
				query Foo2 {
					user {
						...UserFragment
					}
				}
			`,
		],
	},
	{
		title: 'unknown directives',
		pass: false,
		documents: [
			`
				query Foo {
					user {
						firstName @foo
					}
				}
			`,
			`
				query Foo2 {
					user {
						firstName @foo
					}
				}
			`,
		],
	},
	{
		title: 'unknown list fragments errors before generation',
		pass: false,
		// note: we pass parentID here to ensure we're not getting caught on the
		//		 free lists check
		documents: [
			`
				mutation Foo {
					addFriend {
						...UserFragment_insert @parentID(value: "2")
					}
				}
			`,
			`
				mutation Bar {
					addFriend {
						...UserFragment_insert @parentID(value: "2")
					}
				}
			`,
		],
	},
	{
		title: 'known list directives',
		pass: true,
		// note: we pass parentID here to ensure we're not getting caught on the
		//		 free lists check
		documents: [
			`
				query UserFriends {
					user {
						cats @list(name: "Friends") {
							id
						}
					}
				}
			`,
			`
				mutation Bar {
					deleteUser(id: "2") {
						userID @Cat_delete
					}
				}
			`,
		],
	},
	{
		title: 'known connection directives',
		pass: true,
		// note: we pass parentID here to ensure we're not getting caught on the
		//		 free lists check
		documents: [
			`
				query UserFriends {
					user {
						friendsByCursor @list(name: "Friends") {
							edges {
								node {
									id
								}
							}
						}
					}
				}
			`,
			`
				mutation Bar {
					deleteUser(id: "2") {
						userID @User_delete
					}
				}
			`,
		],
	},
	{
		title: 'unknown list directives errors before generation',
		pass: false,
		// note: we pass parentID here to ensure we're not getting caught on the
		//		 free lists check
		documents: [
			`
				mutation Foo {
					deleteUser(id: "2") {
						userID @Foo_delete
					}
				}
			`,
			`
				mutation Bar {
					deleteUser(id: "2") {
						userID @Foo_delete
					}
				}
			`,
		],
	},
	{
		title: 'missing fragment arguments',
		pass: false,
		documents: [
			`
				fragment Foo on Query @arguments(name: { type: "String!" }) {
					users(stringValue: $name) { id }
				}
			`,
			`
				query Query1 {
					...Foo
				}
			`,
			`
				query Query2 {
					...Foo
				}
			`,
		],
	},
	{
		title: 'invalid argument',
		pass: false,
		documents: [
			`
				fragment Foo on Query @arguments(name: { type: "String" }) {
					users(stringValue: $name) { id }
				}
			`,
			`
				query Query1 {
					...Foo @with(bar: "blah", name: "bar")
				}
			`,
			`
				query Query2 {
					...Foo @with(any: true, name: "bar")
				}
			`,
		],
	},
	{
		title: 'unused fragment arguments',
		pass: false,
		documents: [
			`
				fragment Foo1 on Query @arguments(name: { type: "String!" }) {
					users(stringValue: "hello") { id }
				}
			`,
			`
				fragment Foo2 on Query @arguments(name: { type: "String!" }) {
					users(stringValue: "hello") { id }
				}
			`,
		],
	},
	{
		title: 'applied fragment arguments',
		pass: false,
		documents: [
			`
				fragment Foo on Query @arguments(name: { type: "String" }) {
					users(stringValue: $name) { id }
				}
			`,
			`
				query Query2 {
					...Foo @with(name: true)
				}
			`,
			`
				query Query2 {
					...Foo @with(name: true)
				}
			`,
		],
	},
	{
		title: 'fragment argument definition default',
		pass: false,
		documents: [
			`
				fragment FooA on Query @arguments(name: { type: "String", default: true}) {
					users(stringValue: $name) { id }
				}
			`,
			`
				fragment FooB on Query @arguments(name: { type: "String", default: true}) {
					users(stringValue: $name) { id }
				}
			`,
		],
	},
	{
		title: '@paginate offset happy path',
		pass: true,
		documents: [
			`
			fragment UserPaginatedA on User {
				friendsByOffset(limit: 10) @paginate {
					id
				}
			}
			`,
			`
			fragment UserPaginatedB on User {
				friendsByOffset(limit: 10) @paginate {
					id
				}
			}
			`,
		],
	},
	{
		title: 'list of strings passed to fragment argument type argument (woof)',
		pass: false,
		documents: [
			`
			fragment NodePaginatedA on Query @arguments(
				ids: { type: [String] }
			) {
				nodes(ids: $ids) {
					id
				}
			}
			`,
			`
			fragment NodePaginatedB on Query @arguments(
				ids: { type: [String] }
			) {
				nodes(ids: $ids) {
					id
				}
			}
			`,
		],
	},
	{
		title: 'must pass list to list fragment arguments',
		pass: false,
		documents: [
			`
			fragment Fragment on Query @arguments(
				ids: { type: "[String]" }
			) {
				nodes(ids: $ids) {
					id
				}
			}
			`,
			`
			query QueryWithFragmentA {
				...Fragment @with(ids: "A")
			}
			`,
			`
			query QueryWithFragmentB {
				...Fragment @with(ids: "A")
			}
			`,
		],
	},
	{
		title: '@paginate cursor happy path',
		pass: true,
		documents: [
			`
			fragment UserPaginatedA on User {
				friendsByCursor(first: 10) @paginate {
					edges {
						node {
							id
						}
					}
				}
			}
			`,
			`
			fragment UserPaginatedB on User {
				friendsByCursor(first: 10) @paginate {
					edges {
						node {
							id
						}
					}
				}
			}
			`,
		],
	},
	{
		title: 'cursor pagination requires first',
		pass: false,
		documents: [
			`
				fragment UserCursorPaginatedA on User {
					friendsByCursor @paginate {
						edges {
							node {
								id
							}
						}
					}
				}
			`,
			`
				fragment UserCursorPaginatedB on User {
					friendsByCursor @paginate {
						edges {
							node {
								id
							}
						}
					}
				}
			`,
			`
				fragment UserCursorPaginatedC on User {
					friendsByCursor(first: 10) @paginate {
						edges {
							node {
								id
							}
						}
					}
				}
			`,
		],
	},
	{
		title: "@paginate cursor can't go both ways",
		pass: false,
		documents: [
			`
			fragment UserPaginatedA on User {
				friendsByCursor(first: 10, last: 10) @paginate {
					edges {
						node {
							id
						}
					}
				}
			}
			`,
			`
			fragment UserPaginatedB on User {
				friendsByCursor(first: 10, last: 10) @paginate {
					edges {
						node {
							id
						}
					}
				}
			}
			`,
		],
	},
	{
		title: "@paginate can't show up in a document with required args",
		pass: false,
		documents: [
			`
			fragment UserPaginatedA on User @arguments(foo: { type: "String!" }) {
				friendsByCursor(first: 10, after: $foo) @paginate {
					edges {
						node {
							id
						}
					}
				}
			}
			`,
			`
			fragment UserPaginatedB on User @arguments(foo: { type: "String!" }) {
				friendsByCursor(first: 10, after: $foo) @paginate {
					edges {
						node {
							id
						}
					}
				}
			}
			`,
		],
	},
	{
		title: 'offset pagination requires limit',
		pass: false,
		documents: [
			`
				fragment UserPaginatedA on User {
					friendsByOffset @paginate {
						id
					}
				}
			`,
			`
				fragment UserPaginatedB on User {
					friendsByOffset @paginate {
						id
					}
				}
			`,
			`
				fragment UserPaginatedC on User {
					friendsByOffset(limit: 10) @paginate {
						id
					}
				}
			`,
		],
	},
	{
		title: 'multiple @paginate',
		pass: false,
		documents: [
			`
			fragment UserPaginatedA on User {
				friendsByOffset(limit: 10) @paginate {
					id
				}
				friendsByCursor(first: 10) @paginate {
					edges {
						node {
							id
						}
					}
				}
			}
			`,
			`
			fragment UserPaginatedB on User {
				friendsByOffset(limit: 10) @paginate {
					id
				}
				friendsByCursor(first: 10) @paginate {
					edges {
						node {
							id
						}
					}
				}
			}
			`,
		],
	},
	{
		title: '@paginate can fall on an interface if every constituent has a custom key',
		pass: true,
		// name needs to be passed to validate the id field
		documents: [
			`
				query QueryA {
					ghostsByCursor(first: 10) @paginate(name: "GhostA") {
						edges {
							node {
								... on Ghost {
									name
								}
							}
						}
					}
				}
			`,
			`
				query QueryB {
					ghostsByCursor(first: 10) @paginate(name: "GhostB") {
						edges {
							node {
								... on Ghost {
									name
								}
							}
						}
					}
				}
			`,
		],
	},
	{
		title: "@paginate can't fall under lists",
		pass: false,
		documents: [
			`
			fragment UserPaginatedA on User {
				friends {
					friendsByOffset(limit: 10) @paginate {
						id
					}
				}
			}
			`,
			`
			fragment UserPaginatedB on User {
				friends {
					friendsByOffset(limit: 10) @paginate {
						id
					}
				}
			}
			`,
		],
	},
	{
		title: "@paginate can't be in a fragment containing a non Node or configured type",
		pass: false,
		documents: [
			`
			fragment UserPaginatedA on Legend {
				believers (first: 10) @paginate {
					edges {
						node {
							name
						}
					}
				}
			}
			`,
			`
			fragment UserPaginatedA on Legend {
				believers (first: 10) @paginate {
					edges {
						node {
							name
						}
					}
				}
			}
			`,
		],
	},
	{
		title: '@paginate can fall on a fragment of a Node',
		pass: true,
		documents: [
			`
			fragment UserPaginatedA on User {
				believesInConnection (first: 10) @paginate {
					edges {
						node {
							name
						}
					}
				}
			}
			`,
			`
			fragment UserPaginatedB on User {
				believesInConnection (first: 10) @paginate {
					edges {
						node {
							name
						}
					}
				}
			}
			`,
		],
	},
	{
		title: '@paginate can fall on a fragment of a configured type',
		pass: true,
		documents: [
			`
			fragment GhostPaginatedA on Ghost {
				friendsConnection (first: 10) @paginate {
					edges {
						node {
							name
						}
					}
				}
			}
			`,
			`
			fragment GhostPaginatedB on Ghost {
				friendsConnection (first: 10) @paginate {
					edges {
						node {
							name
						}
					}
				}
			}
			`,
		],
	},
]

type Row =
	| {
			title: string
			pass: true
			documents: string[]
			check?: (docs: Document[]) => void
			partial_config?: Partial<Config>
			nb_of_fail?: number
	  }
	| {
			title: string
			pass: false
			documents: string[]
			check?: (result: Error | Error[]) => void
			partial_config?: Partial<Config>
			nb_of_fail?: number
	  }

// run the tests
for (const { title, pass, documents, check, partial_config, nb_of_fail } of table) {
	describe('type check', function () {
		test(
			title,
			pipelineTest(
				testConfig(partial_config),
				documents,
				pass,
				pass
					? undefined
					: check ||
							function (e: Error | Error[]) {
								const nb_of_fail_to_use = nb_of_fail || 2

								// We should always have at least 2 fail tests!
								expect(nb_of_fail_to_use).toBeGreaterThanOrEqual(2)

								// We want to check that all errors are grouped into 1 throw
								// having an array with at least 2 errors
								expect(e).toHaveLength(nb_of_fail_to_use)
							}
			)
		)
	})
}

describe('valueIsType', function () {
	const table: {
		title: string
		equal: boolean
		value: graphql.ValueNode
		type: graphql.TypeNode
	}[] = [
		{
			title: 'NamedTypes - Positive',
			equal: true,
			value: {
				kind: 'StringValue',
				value: '1234',
			},
			type: {
				kind: 'NamedType',
				name: {
					kind: 'Name',
					value: 'String',
				},
			},
		},
		{
			title: 'NamedTypes - Negative',
			equal: false,
			value: {
				kind: 'IntValue',
				value: '1234',
			},
			type: {
				kind: 'NamedType',
				name: {
					kind: 'Name',
					value: 'String',
				},
			},
		},
		{
			title: 'List of Scalars - Positive',
			equal: true,
			value: {
				kind: 'ListValue',
				values: [
					{
						kind: 'IntValue',
						value: '1',
					},
				],
			},
			type: {
				kind: 'ListType',
				type: {
					kind: 'NamedType',
					name: {
						kind: 'Name',
						value: 'Int',
					},
				},
			},
		},
		{
			title: 'List of Scalars - Negative',
			equal: false,
			value: {
				kind: 'ListValue',
				values: [
					{
						kind: 'StringValue',
						value: '1',
					},
				],
			},
			type: {
				kind: 'ListType',
				type: {
					kind: 'NamedType',
					name: {
						kind: 'Name',
						value: 'Int',
					},
				},
			},
		},
		{
			title: 'Mixed Lists',
			equal: false,
			value: {
				kind: 'ListValue',
				values: [
					{
						kind: 'StringValue',
						value: '1',
					},
					{
						kind: 'IntValue',
						value: '1',
					},
				],
			},
			type: {
				kind: 'ListType',
				type: {
					kind: 'NamedType',
					name: {
						kind: 'Name',
						value: 'String',
					},
				},
			},
		},
	]

	for (const row of table) {
		test(row.title, function () {
			expect(valueIsType(testConfig(), row.value, row.type)).toEqual(row.equal)
		})
	}
})

test.todo('@list on root list with no id fails')
