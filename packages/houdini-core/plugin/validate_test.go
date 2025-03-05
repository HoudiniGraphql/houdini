package plugin_test

import (
	"context"
	"fmt"
	"testing"

	"code.houdinigraphql.com/packages/houdini-core/plugin"
	"code.houdinigraphql.com/plugins"
	"code.houdinigraphql.com/plugins/tests"
	"github.com/stretchr/testify/require"
)

func TestValidate_Houdini(t *testing.T) {
	tests.RunTable(t, tests.Table{
		ProjectConfig: plugins.ProjectConfig{
			TypeConfig: map[string]plugins.TypeConfig{
				"Ghost": {
					Keys: []string{"aka", "name"},
				},
			},
			RuntimeScalars: map[string]string{
				"ViewerIDFromSession": "ID",
			},
		},
		Schema: `
			type Subscription {
				newMessage: String
				anotherMessage: String
			}

			type Cat {
				name: String!
			}

			input InputType {
				field: String
				list: [InputType]
			}

			interface Node implements HasID {
				id: ID!
			}

			interface HasID {
				id: ID!
			}

			directive @repeatable repeatable on FIELD

			type Query {
				rootScalar: String
				user(name: String!) : User
				users(filters: [UserFilter], filter: UserFilter): [User!]!
				nodes(ids: [ID!]!): [Node!]!
				entitiesByCursor(first: Int, after: String, last: Int, before: String): EntityConnection!
				node(id: ID!): Node
				ghost: Ghost!
			}

			input UserFilter {
				and: [UserValueFilter]
			}

			input UserValueFilter {
				firstName: String
				hasFriendWith: UserValueFilter
			}

			type Mutation {
				update(input: InputType, list: [InputType]): String
				addFriend: AddFriendOutput!
				deleteUser(id: String!): DeleteUserOutput!
				updateGhost: Ghost!
			}

			union Human = User

			type User implements Node & HasID{
				id: ID!
				parent: User
				firstName: String!
				lastName: String
				friends(offset: Int, limit: Int): [User!]!
				friendsConnection(first: Int, after: String, last: Int, before: String): UserConnection!
				believers(first: Int, after: String, last: Int, before: String): UserConnection!
				bestFriend: User
			}

			type Ghost implements Entity{
				aka: String!
				name: String!
				believers(first: Int, after: String, last: Int, before: String): UserConnection!
			}

			type Legend implements Entity{
				aka: String!
				name: String!
				believers(first: Int, after: String, last: Int, before: String): UserConnection!
			}

			type AddFriendOutput {
				friend: User!
			}

			type DeleteUserOutput {
				userID: ID!
			}

			type UserConnection {
				edges: [UserEdge!]!
				pageInfo: PageInfo!
			}

			type UserEdge {
				cursor: String!
				node: User!
			}

			type PageInfo {
				hasNextPage: Boolean!
				hasPreviousPage: Boolean!
				startCursor: String
				endCursor: String
			}


			interface Entity {
				name: String!
				aka: String!
			}

			type EntityConnection {
				edges: [EntityEdge!]!
				pageInfo: PageInfo!
			}

			type EntityEdge {
				cursor: String!
				node: User!
			}

		`,
		PerformTest: func(t *testing.T, plugin *plugin.HoudiniCore, test tests.Test) {
			ctx := context.Background()

			// load documents into the database
			err := plugin.AfterExtract(context.Background())
			if err != nil {
				if !test.Pass {
					require.NotNil(t, err)

					// make sure that the error has a validation kind
					if validationErr, ok := err.(*plugins.ErrorList); ok {
						// make sure we received a validation error
						err := validationErr.GetItems()[0]
						require.Equal(t, plugins.ErrorKindValidation, err.Kind, fmt.Sprintf("%s: %s", err.Message, err.Detail))
					} else {
						t.Fatal("did not receive error list")
					}
				}
				return
			}

			// run the validation
			err = plugin.Validate(ctx)
			if test.Pass {
				if err != nil {
					msg := err.Error()
					if pluginErr, ok := err.(*plugins.ErrorList); ok {
						msg = pluginErr.GetItems()[0].Message
						t.Fatal(msg)
					}
					require.Nil(t, err, msg)
				}
			} else {
				require.NotNil(t, err)

				// make sure that the error has a validation kind
				if validationErr, ok := err.(*plugins.ErrorList); ok {
					// make sure we received a validation error
					err := validationErr.GetItems()[0]
					require.Equal(t, plugins.ErrorKindValidation, err.Kind, fmt.Sprintf("%s: %s", err.Message, err.Detail))
				} else {
					t.Fatal("did not receive error list")
				}
			}

		},
		Tests: []tests.Test{
			/*
			 * These tests validate the default validation rules that are specified by the spec
			 */
			{
				Name: "Subscription with more than one root field (negative)",
				Pass: false,
				Input: []string{
					`
						subscription TestSub {
							newMessage
							anotherMessage
						}
					`,
				},
			},
			{
				Name: "Subscription with more than one root field (positive)",
				Pass: true,
				Input: []string{
					`subscription TestSub {
				   newMessage
			   }`,
				},
			},
			{
				Name: "Duplicate operation names",
				Pass: false,
				Input: []string{
					`fragment Test on User {
				   firstName
			   }`,
					`query Test {
				   user(name:"foo") {
					   firstName
				   }
			   }`,
				},
			},
			{
				Name: "Fragment references an unknown type",
				Pass: false,
				Input: []string{
					`fragment invalidFragment on NonExistentType {
				   field
			   }`,
				},
			},
			{
				Name: "Fragment defined on a scalar type",
				Pass: false,
				Input: []string{
					`fragment scalarFragment on String {
				   length
			   }`,
				},
			},
			{
				Name: "Using an output type (object type) as a variable type",
				Pass: false,
				Input: []string{
					`query Test($name: Query) {
				   user(arg: $name)
			   }`,
				},
			},
			{
				Name: "Using a scalar as a variable type",
				Pass: true,
				Input: []string{
					`query Test($name: String!) {
				   user(name: $name)
			   }`,
				},
			},
			{
				Name: "Scalar field with a sub-selection",
				Pass: false,
				Input: []string{
					`query Test {
				   rootScalar {
					   first
				   }
			   }`,
				},
			},
			{
				Name: "Querying a field that doesn't exist on the type",
				Pass: false,
				Input: []string{
					`query Test{
				   user(name:"foo") {
					   nonExistentField
				   }
			   }`,
				},
			},
			{
				Name: "Spreading a fragment on an incompatible type",
				Pass: false,
				Input: []string{
					`fragment frag on Cat {
				   name
			   }`,
					`query A {
				   user(name:"foo") {
					   ...frag
				   }
			   }`,
				},
			},
			{
				Name: "Spreading a fragment on a compatible object type",
				Pass: true,
				Input: []string{
					`fragment frag on User {
				   firstName
			   }`,
					`query A {
				   user(name:"foo") {
					   ...frag
				   }
			   }`,
				},
			},
			{
				Name: "Spreading a fragment on a compatible union type",
				Pass: true,
				Input: []string{
					`fragment frag on Human {
				   	... on User {
						firstName
				   	}
			   }`,
					`query A {
				   user(name:"foo") {
					   ...frag
				   }
			   }`,
				},
			},
			{
				Name: "Spreading a fragment on union on a compatible type",
				Pass: true,
				Input: []string{
					`fragment frag on Node {
				   id
			   }`,
					`query A {
				   user(name:"foo") {
					   ...frag
				   }
			   }`,
				},
			},
			{
				Name: "Spreading a fragment on on a compatible interface type",
				Pass: true,
				Input: []string{
					`fragment frag on HasID {
					id
				}`,
					`query A {
					node(id: "1") {
						...frag
					}
				}`,
				},
			},
			{
				Name: "Fragment cycles",
				Pass: false,
				Input: []string{
					`query Test{
				   user(name:"foo") {
					   ...A
				   }
			   }`,
					`fragment A on User {
				   firstName
				   ...B
			   }`,
					`fragment B on User {
				   firstName
				   ...A
			   }`,
				},
			},
			{
				Name: "Defining the same variable twice",
				Pass: false,
				Input: []string{
					`query Test($a: String, $a: String) {
				   user(name: "foo") {
					   firstName
				   }
			   }`,
				},
			},
			{
				Name: "Using an undefined variable",
				Pass: false,
				Input: []string{
					`query Test {
				   user(name: $undefined) {
					   firstName
				   }
			   }`,
				},
			},
			{
				Name: "Variable defined but never used",
				Pass: false,
				Input: []string{
					`query Test($unused: String) {
				   user(name:"foo") {
					   firstName
				   }
			   }`,
				},
			},
			{
				Name: "Variable used only in directive",
				Pass: true,
				Input: []string{
					`query Test($message: String) {
				   user(name: "foo") {
					   firstName @deprecated(reason: $message)
				   }
			   }`,
				},
			},
			{
				Name: "Using an unknown directive",
				Pass: false,
				Input: []string{
					`query Test{
				   user(name:"foo") @unknown {
					   firstName
				   }
			   }`,
				},
			},
			{
				Name: "Repeating the same non-repeatable directive on a field",
				Pass: false,
				Input: []string{
					`query Test {
				   user(name:"foo") @include(if: true) @include(if: false) {
					   firstName
				   }
			   }`,
				},
			},
			{
				Name: "Repeating a repeatable directive on a field",
				Pass: true,
				Input: []string{
					`query Test{
				   user(name:"foo") @repeatable @repeatable {
					   firstName
				   }
			   }`,
				},
			},
			{
				Name: "Duplicating an argument in a field",
				Pass: false,
				Input: []string{
					`query Test{
				   user(name: "value", name: "another")
			   }`,
				},
			},
			{
				Name: "Duplicate keys in an input object",
				Pass: false,
				Input: []string{
					`mutation Test {
				   update(input: { field: "value", field: "another value" })
			   }`,
				},
			},
			{
				Name: "Missing a required argument",
				Pass: false,
				Input: []string{
					`query Test {
				   user {
					   firstName
				   }
			   }`,
				},
			},
			{
				Name: "Threading a required argument through",
				Pass: true,
				Input: []string{
					`query Test($name: String!) {
				   user(name: $name) {
					   firstName
				   }
			   }`,
				},
			},
			{
				Name: "Variable used in a position with an incompatible type",
				Pass: false,
				Input: []string{
					`query Test($var: String) {
				   user(name: $var) {
					   firstName
				   }
			   }`,
				},
			},
			{
				Name: "Variable used in a position with a compatible type",
				Pass: true,
				Input: []string{
					`query Test($var: String!) {
				   user(name: $var) {
					   firstName
				   }
			   }`,
				},
			},
			{
				Name: "Non-required variables passed to required arg",
				Pass: false,
				Input: []string{
					`query Test($var: String) {
				   user(name: $var) {
					   firstName
				   }
			   }`,
				},
			},
			{
				Name: "Conflicting field selections that cannot be merged",
				Pass: false,
				Input: []string{
					`query Test{
				   user(name:"foo") {
					   name: firstName
					   name: lastName
				   }
			   }`,
				},
			},
			{
				Name: "Non-conflicting field selections across multiple fragments",
				Pass: true,
				Input: []string{
					`fragment UserInfo on User {
					id
			   }`,
					`fragment Test on Node{
					id
			  	}`,
				},
			},
			{
				Name: "Non-conflicting field selections in the same document",
				Pass: true,
				Input: []string{
					`fragment UserInfo on User {
					friends {
						id
					}
					friends {
						id
					}
			   }`,
				},
			},
			{
				Name: "Can query __typename on objects",
				Pass: true,
				Input: []string{
					`query Test {
					user(name: "foo") {
						__typename
					}
				}`,
				},
			},
			{
				Name: "Can query __typename on interfaces",
				Pass: true,
				Input: []string{
					`query Test {
					node(id: "foo") {
						__typename
					}
				}`,
				},
			},
			{
				Name: "Can query __typename on unions",
				Pass: true,
				Input: []string{
					`fragment HumanInfo on Human {
					__typename
				}`,
				},
			},
			{
				Name: "Providing an argument value of the wrong type",
				Pass: false,
				Input: []string{
					`query Test{
				   user(name: 1) {
					   firstName
				   }
			   }`,
				},
			},
			{
				Name: "Providing a nested argument value of the wrong type",
				Pass: false,
				Input: []string{
					`mutation Test {
				   update(input: { field: 1 })
			   }`,
				},
			},
			{
				Name: "Providing a deeply nested argument value of the wrong type",
				Pass: false,
				Input: []string{
					`mutation Test {
				   update(list: [{ field: 2 }])
			   }`,
				},
			},
			{
				Name: "Providing multiple deeply nested argument values with one wrong type",
				Pass: false,
				Input: []string{
					`mutation Test {
				   update(list: [{ field: 2 }, { field: "String"}])
			   }`,
				},
			},
			{
				Name: "No aliases for default keys",
				Pass: false,
				Input: []string{
					`query QueryA {
					user(name: "foo") {
						id: firstName
					}
				}`,
				},
			},
			{
				Name: "No aliases for configured keys",
				Pass: false,
				Input: []string{
					`query QueryA {
					ghost {
						aka: age
					}
				}`,
				},
			},
			{
				Name: "allows documents spread across multiple sources",
				Pass: true,
				Input: []string{
					`query QueryA {
					user(name: "foo") {
						...FragmentA
					}
				}`,
					`query QueryB {
					user(name: "foo") {
						...FragmentA
					}
				}`,
					`fragment FragmentA on User {
					firstName
				}`,
				},
			},
			{
				Name: "Valid arguments on directives",
				Pass: true,
				Input: []string{
					`query TestQuery {
						user(name: "foo") {
							friends @list(name: "Friends") {
								id
							}
						}
					}`,
				},
			},
			{
				Name: "Invalid arguments on directives",
				Pass: false,
				Input: []string{
					`query TestQuery {
						user(name: "foo") {
							friends @list(foo: "Friends") {
								id
							}
						}
					}`,
				},
			},
			{
				Name: "@list on query",
				Pass: true,
				Input: []string{
					`query TestQuery {
					user(name: "foo") {
						friends @list(name: "Friends") {
							id
						}
					}
				}`,
					`mutation MutationM {
					addFriend {
						friend {
							...Friends_insert
						}
					}
				}`,
				},
			},
			{
				Name: "@list and @paginate on the same field",
				Pass: false,
				Input: []string{
					`query TestQuery {
						user(name: "foo") {
							friends @list(name: "Friends") @paginate {
								id
							}
						}
					}`,
				},
			},
			{
				Name: "no @parentID @allLists on _insert, but defaultListTarget",
				Pass: true,
				Input: []string{
					`query TestQuery {
						user(name: "foo") {
							friends {
								friends @list(name: "Friends") {
									id
								}
							}
						}
					}`,
					`mutation MutationM1 {
						addFriend {
							friend {
								...Friends_insert
							}
						}
					}`,
				},
				ProjectConfig: func(config *plugins.ProjectConfig) {
					config.DefaultListTarget = "all"
				},
			},
			{
				Name: "@parentID @allLists on _insert",
				Pass: false,
				Input: []string{
					`query TestQuery {
					user(name: "foo") {
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
				},
			},
			{
				Name: "@mask_enable @mask_disable on fragment",
				Pass: false,
				Input: []string{
					`fragment FooA on Query {
					users(stringValue: $name) { id }
				}`,
					`query TestQuery {
					...FooA @mask_enable @mask_disable
				}`,
				},
			},
			{
				Name: "@list name must be unique",
				Pass: false,
				Input: []string{
					`
                query TestQuery1 {
					user(name: "foo") {
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
					user(name: "foo") {
						friends {
							friends @list(name: "Friends") {
								id
							}
						}
					}
				}
            	`,
				},
			},
			{
				Name: "@list with parentID as variable on query",
				Pass: true,
				Input: []string{
					`query TestQuery {
					user(name: "foo") {
						friends {
							friends @list(name: "Friends") {
								id
							}
						}
					}
        		}`,
					`mutation MutationM1($parentID: ID!) {
					addFriend {
						...Friends_insert @prepend @parentID(value: $parentID)
					}
				}`,
				},
			},
			{
				Name: "@prepend and @append cannot appear on the same fragment",
				Pass: false,
				Input: []string{
					`query TestQuery {
					users @list(name: "Friends") {
						firstName
					}
        		}`,
					`mutation MutationM1($parentID: ID!) {
					addFriend {
						...Friends_insert @prepend @append
					}
				}`,
				},
			},
			{
				Name: "@parentID cannot appear alongside @allLists",
				Pass: false,
				Input: []string{
					`fragment FragmentA on User {
					friends @list(name: "Friends") {
						firstName
					}
                }`,
					`mutation Mutation1 {
					addFriend {
						...Friends_insert @parentID(value: "1") @allLists
					}
                }`,
				},
			},
			{
				Name: "@list without parentID on fragment",
				Pass: false,
				Input: []string{
					`fragment FragmentA on User {
					friends @list(name: "Friends") {
						firstName
					}
                }`,
					`mutation Mutation1 {
					addFriend {
						...Friends_insert
					}
                }`,
				},
			},
			{
				Name: "@list doesn't need parentID on free list",
				Pass: true,
				Input: []string{
					`
					query UserFriends {
						user(name: "foo") {
							bestFriend {
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
				},
			},
			{
				Name: "@list prepend on query no id",
				Pass: false,
				Input: []string{
					`
					query UserFriends {
						user(name: "foo") {
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
				},
			},
			{
				Name: "@list prepend on query with id",
				Pass: true,
				Input: []string{
					`
					query UserFriends {
						user(name: "foo") {
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
							...Friends_insert @prepend @parentID(value: "2")
						}
					}
            	`,
				},
			},
			{
				Name: "@list prepend on query with @allLists",
				Pass: true,
				Input: []string{
					`
					query UserFriends {
						user(name: "foo") {
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
							...Friends_insert @prepend @allLists
						}
					}
            	`,
				},
			},
			{
				Name: "@list append on query no id",
				Pass: false,
				Input: []string{
					`
					query UserFriends {
						user(name: "foo") {
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
				},
			},
			{
				Name: "@list no directive on query",
				Pass: false,
				Input: []string{
					`
					query UserFriends {
						user(name: "foo") {
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
				},
			},
			{
				Name: "Unknown fragments",
				Pass: false,
				Input: []string{
					`
					query Foo {
						user(name: "foo") {
							...UserFragment
						}
					}
				`,
				},
			},
			{
				Name: "unknown list fragments",
				Pass: false,
				Input: []string{
					`
					mutation Foo {
						addFriend {
							...UserFragment_insert @parentID(value: "2")
						}
					}
				`,
				},
			},
			{
				Name: "list directive on invalid type",
				Pass: false,
				Input: []string{
					`
					query UserInfo {
						user(name: "foo") {
							bestFriend @list(name:"BestFriends") {
								firstName
							}
						}
					}
				`,
				},
			},
			{
				Name: "known list directives",
				Pass: true,
				Input: []string{
					`
				query UserFriends {
					user(name: "foo") {
						friends @list(name: "Friends") {
							id
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
				},
			},
			{
				Name: "known connection directives",
				Pass: true,
				Input: []string{
					`
				query UserFriends {
					user(name: "foo") {
						friendsConnection @list(name: "Friends") {
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
				},
			},
			{
				Name: "unknown list directives",
				Pass: false,
				Input: []string{
					`
					mutation Foo {
						deleteUser(id: "2") {
							userID @Foo_delete
						}
					}
				`,
				},
			},
			{
				Name: "unused fragment arguments",
				Pass: false,
				Input: []string{
					`
					fragment Foo1 on Query @arguments(name: { type: "String!" }) {
						users(stringValue: "hello") { id }
					}
				`,
				},
			},
			{
				Name: "used variable in deeply nested list argument",
				Pass: true,
				Input: []string{
					`
					query UserInfo($name: String) {
						users (filters: [{ and: [{ firstName: $name }] }]) {
							id
						}
					}
				`,
				},
			},
			{
				Name: "used variable in deeply nested object argument",
				Pass: true,
				Input: []string{
					`
					query UserInfo($name1: String, $name2: String) {
						users (filter: {
							and: [
								{ hasFriendWith: { firstName: $name1 }},
								{ hasFriendWith: { firstName: $name2 }}
							]
						}) {
							id
						}
					}
				`,
				},
			},
			{
				Name: "Assigning object to list in deeply nested argument",
				Pass: false,
				Input: []string{
					`
					query UserInfo($name: String) {
						users (filters: { and: [{ hasFriendWith: { firstName: $name }}] }) {
							id
						}
					}
				`,
				},
			},
			{
				Name: "Assigning list to object in deeply nested argument",
				Pass: false,
				Input: []string{
					`
					query UserInfo($name: String) {
						users (filter: [
							{
								and: [{ hasFriendWith: { firstName: $name }}]
							}
						]) {
							id
						}
					}
				`,
				},
			},
			{
				Name: "missing fragment arguments",
				Pass: false,
				Input: []string{
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
				},
			},
			{
				Name: "invalid argument",
				Pass: false,
				Input: []string{
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
				},
			},
			{
				Name: "applied fragment arguments",
				Pass: false,
				Input: []string{
					`
					fragment Foo on Query @arguments(name: { type: "String" }, otherName: { type: "String" }) {
						users(stringValue: $name) { id }
						more: users(stringValue: $otherName) { id }
					}
				`,
					`
					query Query2 {
						...Foo @with(name: {value:"hello"})
					}
				`,
				},
			},
			{
				Name: "fragment argument definition default",
				Pass: false,
				Input: []string{
					`
						fragment FooA on Query @arguments(name: { type: "String", default: true}) {
							users(stringValue: $name) { id }
						}
					`,
				},
			},
			{
				Name: "@paginate offset happy path",
				Pass: true,
				Input: []string{
					`
					fragment UserPaginatedA on User {
						friends(limit: 10) @paginate {
							id
						}
					}
				`,
				},
			},
			{
				Name: "list of strings passed to fragment argument type argument (woof)",
				Pass: false,
				Input: []string{
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
					query QueryWithFragmentA {
						...Fragment @with(ids: ["A"])
					}
				`,
				},
			},
			{
				Name: "must pass list to list fragment arguments",
				Pass: false,
				Input: []string{
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
				},
			},
			{
				Name: "@paginate cursor happy path",
				Pass: true,
				Input: []string{
					`
					fragment UserPaginatedA on User {
						friendsConnection(first: 10) @paginate {
							edges {
								node {
									id
								}
							}
						}
					}
				`,
				},
			},
			{
				Name: "cursor pagination requires first",
				Pass: false,
				Input: []string{
					`
					fragment UserCursorPaginatedA on User {
						friendsConnection @paginate {
							edges {
								node {
									id
								}
							}
						}
					}
				`,
				},
			},
			{
				Name: "limit pagination requires first",
				Pass: false,
				Input: []string{
					`
					fragment UserCursorPaginatedA on User {
						friends @paginate {
							id
						}
					}
				`,
				},
			},
			{
				Name: "@paginate Infinite cursor can't go both ways",
				Pass: false,
				Input: []string{
					`
					fragment UserPaginatedA on User {
						friendsConnection(first: 10, last: 10) @paginate(mode: Infinite) {
							edges {
								node {
									id
								}
							}
						}
					}
				`,
				},
			},
			{
				Name: "@paginate SinglePage cursor can go both ways",
				Pass: true,
				Input: []string{
					`
					query UserPaginatedA($first: Int, $last: Int) {
						user(name: "foo") {
							friendsConnection(first: $first, last: $last) @paginate(mode: SinglePage) {
								edges {
									node {
										id
									}
								}
							}
						}
					}
					`,
				},
			},
			{
				Name: "@paginate can show up in a document with required args",
				Pass: true,
				Input: []string{
					`
					fragment UserPaginatedA on User @arguments(foo: { type: "String!" }) {
						friendsConnection(first: 10, after: $foo) @paginate {
							edges {
								node {
									id
								}
							}
						}
					}
				`,
				},
			},
			{
				Name: "offset pagination requires limit",
				Pass: false,
				Input: []string{
					`
					fragment UserPaginatedA on User {
						friends @paginate {
							id
						}
					}
				`,
				},
			},
			{
				Name: "multiple @paginate",
				Pass: false,
				Input: []string{
					`
					fragment UserPaginatedA on User {
						friends(limit: 10) @paginate {
							id
						}
						friendsConnection(first: 10) @paginate {
							edges {
								node {
									id
								}
							}
						}
					}
				`,
				},
			},
			{
				Name: "@paginate can fall on an interface if every constituent has a custom key",
				Pass: true,
				// name needs to be passed to validate the id field
				Input: []string{
					`
					query QueryA {
						entitiesByCursor(first: 10) @paginate(name: "GhostA") {
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
				},
			},
			{
				Name: "@paginate can't fall under lists",
				Pass: false,
				Input: []string{
					`
					fragment UserPaginatedA on User {
						friends {
							friends(limit: 10) @paginate {
								id
							}
						}
					}
				`,
				},
			},
			{
				Name: "@paginate can't be in a fragment containing a non Node or configured type",
				Pass: false,
				Input: []string{
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
				},
			},
			{
				Name: "@paginate can fall on a fragment of a Node",
				Pass: true,
				Input: []string{
					`
					fragment UserPaginatedA on User {
						friendsConnection (first: 10) @paginate {
							edges {
								node {
									firstName
								}
							}
						}
					}
				`,
				},
			},
			{
				Name: "@paginate must fall on something with configured lookups",
				Pass: false,
				Input: []string{
					`
					fragment UserPaginatedA on Ghost {
						believers (first: 10) @paginate {
							edges {
								node {
									firstName
								}
							}
						}
					}
				`,
				},
			},
			{
				Name: "@paginate can fall on a fragment of a configured type",
				Pass: true,
				Input: []string{
					`
					fragment UserPaginated on User {
						friendsConnection (first: 10) @paginate {
							edges {
								node {
									firstName
								}
							}
						}
					}
				`,
				},
			},
			{
				Name: "unreachable @loading",
				Pass: false,
				Input: []string{
					`
					fragment LoadingDirectiveA on User {
						friendsConnection {
							edges {
								node @loading {
									firstName
								}
							}
						}
					}
				`,
				},
			},
			{
				Name: "floating @loading with global flag",
				Pass: true,
				Input: []string{
					`
					fragment LoadingDirectiveA on User @loading {
						friendsConnection {
							edges {
								node @loading {
									firstName
								}
							}
						}
					}
				`,
				},
			},
			{
				Name: "@required may not be used on query arguments",
				Pass: false,
				Input: []string{
					`
					query QueryA($id: ID! @required) {
						node(id: $id) {
							... on User {
								name
							}
						}
					}
				`,
				},
			},
			{
				Name: "@loading happy path",
				Pass: true,
				Input: []string{
					`
					fragment LoadingDirectiveA on User {
						friendsConnection @loading {
							edges @loading {
								node @loading {
									firstName
								}
							}
						}
					}
				`,
				},
			},
			{
				Name: "@loading floating on fragment spread",
				Pass: false,
				Input: []string{
					`
					fragment UserInfo on User {
						id
					}
				`,
					`
					query A {
						user  {
							...UserInfo @loading
						}
					}
				`,
				},
			},
			{
				Name: "@loading must fall on inline fragment",
				Pass: false,
				Input: []string{
					`
					query A {
						node @loading {
							... on User {
								firstName @loading
							}
						}
					}
				`,
				},
			},
			{
				Name: "@optimisticKey on single key",
				Pass: true,
				Input: []string{
					`
					mutation B {
						addFriend  {
							friend {
								id @optimisticKey
							}
						}
					}
				`,
				},
			},
			{
				Name: "@optimisticKey on non-key",
				Pass: false,
				Input: []string{
					`
							mutation B {
								addFriend  {
									friend {
										firstName @optimisticKey
									}
								}
							}
						`,
				},
			},
			{
				Name: "@optimisticKey on multiple key - missing",
				Pass: false,
				Input: []string{
					`
							mutation A {
								updateGhost  {
									aka @optimisticKey
								}
							}
						`,
				},
			},
			{
				Name: "@optimisticKey on multiple key - found",
				Pass: true,
				Input: []string{
					`
							mutation A {
								updateGhost  {
									aka @optimisticKey
									name @optimisticKey
								}
							}
						`,
				},
			},
			{
				Name: "@optimisticKey on non-mutation",
				Pass: false,
				Input: []string{
					`
							query A {
								ghost  {
									aka @optimisticKey
									name @optimisticKey
								}
							}
						`,
				},
			},
			{
				Name: "@optimisticKey on object type",
				Pass: false,
				Input: []string{
					`
							mutation A {
								updateGhost @optimisticKey {
									aka
									name
								}
							}
						`,
				},
			},
			{
				Name: "@required may not be used on non-nullable fields",
				Pass: false,
				Input: []string{
					`
							query QueryA {
								user(name: "foo") {
									firstName @required
								}
							}
						`,
				},
			},
			{
				Name: "@required may be used on non-nullable fields if the child is marked with @required",
				Pass: true,
				Input: []string{
					`
							query QueryA {
								user(name: "foo") @required {
									parent @required {
										firstName
									}
								}
							}
						`,
				},
			},
			{
				Name: "@loading on inline fragment",
				Pass: true,
				Input: []string{
					`
							query A {
								node(id: "1") @loading {
									... on User @loading {
										firstName @loading
									}
								}
							}
						`,
				},
			},
			{
				Name: "runtime scalars",
				Pass: true,
				Input: []string{
					`
							query A($id: ViewerIDFromSession!) {
								node(id: $id) {
									id
								}
							}
						`,
				},
			},
		},
	})
}
