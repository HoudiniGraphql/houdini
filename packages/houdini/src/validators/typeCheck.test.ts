// locals
import { pipelineTest } from '../testUtils'
import '../../../../jest.setup'
import { CollectedGraphQLDocument } from '../types'
import { HoudiniError } from '../error'

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
		],
	},
	{
		title: 'unknown fields in queries',
		pass: false,
		documents: [
			`
                query {
                    user {
                        foo
                    }
                }
            `,
		],
	},
	{
		title: '@connection on query',
		pass: true,
		documents: [
			`
                query TestQuery {
					user {
						friends @connection(name: "Friends") {
							id
						}
					}
                }
            `,
			`
                mutation Mutation {
					addFriend {
						...Friends_insert
					}
                }
            `,
		],
	},
	{
		title: '@connection with parentID on query',
		pass: true,
		documents: [
			`
                query TestQuery {
					user {
						friends {
							friends @connection(name: "Friends") {
								id
							}
						}
					}
                }
            `,
			`
                mutation Mutation {
					addFriend {
						...Friends_insert @prepend(parentID: "1234")
					}
                }
            `,
		],
	},
	{
		title: '@connection with parentID as variable on query',
		pass: true,
		documents: [
			`
                query TestQuery {
					user {
						friends {
							friends @connection(name: "Friends") {
								id
							}
						}
					}
                }
            `,
			`
                mutation Mutation($parentID: ID!) {
					addFriend {
						...Friends_insert @prepend(parentID: $parentID)
					}
                }
            `,
		],
	},
	{
		title: '@connection without parentID on fragment',
		pass: false,
		documents: [
			`
                fragment FragmentA on User {
					friends @connection(name: "Friends") {
						firstName
					}
                }
            `,
			`
                mutation Mutation {
					addFriend {
						...Friends_insert
					}
                }
            `,
		],
	},
	{
		title: '@connection prepend on query no id',
		pass: false,
		documents: [
			`
                query UserFriends {
					user {
						friends {
							friends @connection(name: "Friends") {
								id
							}
						}
					}
                }
            `,
			`
                mutation Mutation {
					addFriend {
						...Friends_insert @prepend
					}
                }
            `,
		],
	},
	{
		title: '@connection append on query no id',
		pass: false,
		documents: [
			`
                query UserFriends {
					user {
						friends {
							friends @connection(name: "Friends") {
								id
							}
						}
					}
                }
            `,
			`
                mutation Mutation {
					addFriend {
						...Friends_insert @append
					}
                }
            `,
		],
	},
	{
		title: '@connection no directive on query',
		pass: false,
		documents: [
			`
                query UserFriends {
					user {
						friends {
							friends @connection(name: "Friends") {
								id
							}
						}
					}
                }
            `,
			`
                mutation Mutation {
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
		],
	},
	{
		title: 'unknown connection fragments errors before generation',
		pass: false,
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
		check: function (e: HoudiniError | HoudiniError[]) {
			expect(e).toHaveLength(2)
		},
	},
	{
		title: 'returns multiple errors',
		pass: false,
		documents: [
			`
                fragment FragmentA on Foo {
                    bar
                }
            `,
			`
                fragment FragmentA on Foo {
                    bar
                }
            `,
		],
		check: function (e: HoudiniError | HoudiniError[]) {
			expect(e).toHaveLength(2)
		},
	},
]

type Row =
	| {
			title: string
			pass: true
			documents: string[]
			check?: (docs: CollectedGraphQLDocument[]) => void
	  }
	| {
			title: string
			pass: false
			documents: string[]
			check?: (result: HoudiniError | HoudiniError[]) => void
	  }

// run the tests
for (const { title, pass, documents, check } of table) {
	describe('type check', function () {
		// run the pipeline over the documents
		pipelineTest(title, documents, pass, check)
	})
}

test.todo('Unknown connection fragments')

test.todo('@connection on root list with no id fails')
