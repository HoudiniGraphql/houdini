// locals
import { pipelineTest } from '../testUtils'
import '../../../../jest.setup'
import { CollectedGraphQLDocument, HoudiniError } from '../types'

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
                mutation Mutation {
					addFriend {
						...Friends_insert
					}
                }
            `,
		],
	},
	{
		title: '@list with parentID on query',
		pass: true,
		documents: [
			`
                query TestQuery {
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
                mutation Mutation {
					addFriend {
						...Friends_insert @prepend(parentID: "1234")
					}
                }
            `,
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
			`
                query TestQuery {
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
                mutation Mutation($parentID: ID!) {
					addFriend {
						...Friends_insert @prepend(parentID: $parentID)
					}
                }
            `,
		],
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
                mutation Mutation {
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
                mutation Mutation {
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
                mutation Mutation {
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
                mutation Mutation {
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
		title: 'unknown connection fragments errors before generation',
		pass: false,
		// note: we pass parentID here to ensure we're not getting caught on the
		//		 free connections check
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
		title: 'known connection directives',
		pass: true,
		// note: we pass parentID here to ensure we're not getting caught on the
		//		 free connections check
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
		title: 'unknown connection directives errors before generation',
		pass: false,
		// note: we pass parentID here to ensure we're not getting caught on the
		//		 free connections check
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
				fragment Foo on Query @arguments(name: { type: "String"}) {
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
				fragment Foo on Query @arguments(name: { type: "String"}) {
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
		title: 'applied fragment arguments',
		pass: false,
		documents: [
			`
				fragment Foo on Query @arguments(name: { type: "String"}) {
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
				fragment Foo on Query @arguments(name: { type: "String", default: true}) {
					users(stringValue: $name) { id }
				}
			`,
			`
				fragment Foo on Query @arguments(name: { type: "String", default: true}) {
					users(stringValue: $name) { id }
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
		pipelineTest(
			title,
			documents,
			pass,
			pass
				? undefined
				: check ||
						function (e: HoudiniError | HoudiniError[]) {
							expect(e).toHaveLength(2)
						}
		)
	})
}

test.todo('@list on root list with no id fails')
