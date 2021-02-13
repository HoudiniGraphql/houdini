// external imports
import * as graphql from 'graphql'
import { HoudiniError } from 'houdini-common'
// locals
import { pipelineTest } from '../testUtils'
import '../../../../jest.setup'
import { CollectedGraphQLDocument } from '../types'

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
						...Friends_Connection
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
						...Friends_Connection @prepend(parentID: "1234")
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
						...Friends_Connection @prepend(parentID: $parentID)
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
						...Friends_Connection
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
						...Friends_Connection @prepend
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
						...Friends_Connection @append
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
						...Friends_Connection
					}
                }
            `,
		],
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
