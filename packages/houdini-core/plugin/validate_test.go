package plugin_test

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"

	"code.houdinigraphql.com/packages/houdini-core/config"
	"code.houdinigraphql.com/packages/houdini-core/plugin"
	"code.houdinigraphql.com/plugins"
	"code.houdinigraphql.com/plugins/tests"
)

func TestValidate_Houdini(t *testing.T) {
	tests.RunTable(t, tests.Table[config.PluginConfig, *plugin.HoudiniCore]{
		ProjectConfig: plugins.ProjectConfig{
			TypeConfig: map[string]plugins.TypeConfig{
				"Ghost": {
					Keys: []string{"aka", "name"},
				},
				"Cat": {
					Keys:         []string{"name"},
					ResolveQuery: "cat",
				},
			},
			RuntimeScalars: map[string]string{
				"ViewerIDFromSession": "ID",
			},
			Scalars: map[string]plugins.ScalarConfig{
				"Date": {
					Type:       "Date",
					InputTypes: []string{"String", "Date"},
				},
			},
		},
		Schema: `
			scalar Date

			type Subscription {
				newMessage: String
				anotherMessage: String
				userUpdate: User
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

			interface HasFriends {
				friends(offset: Int, limit: Int): [User!]!
			}

			directive @repeatable repeatable on FIELD

			enum UserRole {
				ADMIN
				USER
			}

			type Query {
				rootScalar: String
				user(name: String! birthday: Date) : User
				users(filters: [UserFilter], filter: UserFilter, limit: Int, offset: Int): [User!]!
				usersByRole(role: UserRole, roles: [UserRole!], minWeight: Float): [User!]!
				nodes(ids: [ID!]!): [Node!]!
				entitiesByCursor(first: Int, after: String, last: Int, before: String): EntityConnection!
				node(id: ID!): Node
				ghost: Ghost!
				cat(name: String!): Cat
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
				deleteUser(id: ID!): DeleteUserOutput!
				updateGhost: Ghost!
				updateNode: Node
			}

			union Human = User

			type User implements Node & HasID & HasFriends{
				id: ID!
				parent: User
				firstName: String!
				lastName: String
				avatarURL(size: Int): String
				greeting(uppercase: Boolean! = false): String!
				friends(offset: Int, limit: Int): [User!]!
				friendsConnection(first: Int, after: String, last: Int, before: String): UserConnection!
				believers(first: Int, after: String, last: Int, before: String): UserConnection!
				bestFriend: User
			}

			type Ghost implements Entity {
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
		PerformTest: func(t *testing.T, plugin *plugin.HoudiniCore, test tests.Test[config.PluginConfig]) {
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
						require.Equal(
							t,
							plugins.ErrorKindValidation,
							err.Kind,
							fmt.Sprintf("%s: %s", err.Message, err.Detail),
						)
					} else {
						t.Fatal("did not receive error list")
					}
				} else {
					require.Nil(t, err, err.Error())
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
		Tests: []tests.Test[config.PluginConfig]{
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
				Name: "Non-null argument with default value is not required",
				Pass: true,
				Input: []string{
					`query Test {
				   user(name: "foo") {
					   greeting
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
				Name: "List arguments can be passed as static values",
				Pass: true,
				Input: []string{
					`query Test {
					nodes(ids: [1, 2, 3]) {
						id
					}
				}`,
				},
			},
			{
				Name: "List arguments with static values of the wrong element type",
				Pass: false,
				Input: []string{
					`query Test {
					nodes(ids: [true, false]) {
						id
					}
				}`,
				},
			},
			{
				Name: "Static lists cannot contain null when the element type is non-null",
				Pass: false,
				Input: []string{
					`query Test {
					nodes(ids: [null]) {
						id
					}
				}`,
				},
			},
			{
				Name: "Static lists cannot be passed to non-list arguments",
				Pass: false,
				Input: []string{
					`query Test {
					user(name: ["foo"]) {
						firstName
					}
				}`,
				},
			},
			{
				Name: "Nested static lists of input objects",
				Pass: true,
				Input: []string{
					`query Test {
					users(filters: [{ and: [{ firstName: "foo" }] }]) {
						id
					}
				}`,
				},
			},
			{
				Name: "Int literals coerce to Float",
				Pass: true,
				Input: []string{
					`query Test {
					usersByRole(minWeight: 2) {
						id
					}
				}`,
				},
			},
			{
				Name: "Float literals do not coerce to Int",
				Pass: false,
				Input: []string{
					`query Test {
					users(limit: 1.5) {
						id
					}
				}`,
				},
			},
			{
				Name: "Block strings are strings",
				Pass: true,
				Input: []string{
					`query Test {
					user(name: """foo""") {
						id
					}
				}`,
				},
			},
			{
				Name: "Single values coerce to lists",
				Pass: true,
				Input: []string{
					`query Test {
					nodes(ids: "1") {
						id
					}
				}`,
				},
			},
			{
				Name: "Enum values can be passed to enum arguments",
				Pass: true,
				Input: []string{
					`query Test {
					usersByRole(role: ADMIN) {
						id
					}
				}`,
				},
			},
			{
				Name: "Unknown enum values are rejected",
				Pass: false,
				Input: []string{
					`query Test {
					usersByRole(role: SUPERADMIN) {
						id
					}
				}`,
				},
			},
			{
				Name: "Strings cannot be passed to enum arguments",
				Pass: false,
				Input: []string{
					`query Test {
					usersByRole(role: "ADMIN") {
						id
					}
				}`,
				},
			},
			{
				Name: "Enum values inside static lists",
				Pass: true,
				Input: []string{
					`query Test {
					usersByRole(roles: [ADMIN, USER]) {
						id
					}
				}`,
				},
			},
			{
				Name: "Nullable variables with defaults satisfy non-null arguments",
				Pass: true,
				Input: []string{
					`query Test($id: ID = "1") {
					node(id: $id) {
						id
					}
				}`,
				},
			},
			{
				Name: "Variable defaults do not forgive inner nullability",
				Pass: false,
				Input: []string{
					`query Test($ids: [ID] = ["1"]) {
					nodes(ids: $ids) {
						id
					}
				}`,
				},
			},
			{
				Name: "Unknown fields on input objects",
				Pass: false,
				Input: []string{
					`mutation Test {
					update(input: { unknown: 1 })
				}`,
				},
			},
			{
				Name: "Fragment arguments with list defaults",
				Pass: true,
				Input: []string{
					`fragment Fragment on Query @arguments(
					ids: { type: "[ID!]!", default: ["1"] }
				) {
					nodes(ids: $ids) {
						id
					}
				}`,
				},
			},
			{
				Name: "@with values must match the fragment argument type",
				Pass: false,
				Input: []string{
					`fragment Fragment on User @arguments(
					offset: { type: "Int" }
				) {
					friends(offset: $offset) {
						id
					}
				}`,
					`query Test {
					user(name: "foo") {
						...Fragment @with(offset: "five")
					}
				}`,
				},
			},
			{
				Name: "@with values matching the fragment argument type",
				Pass: true,
				Input: []string{
					`fragment Fragment on User @arguments(
					offset: { type: "Int" }
				) {
					friends(offset: $offset) {
						id
					}
				}`,
					`query Test {
					user(name: "foo") {
						...Fragment @with(offset: 5)
					}
				}`,
				},
			},
			{
				Name: "@with cannot pass null to non-null fragment arguments",
				Pass: false,
				Input: []string{
					`fragment Fragment on Query @arguments(
					ids: { type: "[ID!]!" }
				) {
					nodes(ids: $ids) {
						id
					}
				}`,
					`query Test {
					...Fragment @with(ids: null)
				}`,
				},
			},
			{
				Name: "@with can pass empty lists to non-null list arguments",
				Pass: true,
				Input: []string{
					`fragment Fragment on Query @arguments(
					ids: { type: "[ID!]!" }
				) {
					nodes(ids: $ids) {
						id
					}
				}`,
					`query Test {
					...Fragment @with(ids: [])
				}`,
				},
			},
			{
				Name: "@with accepts known enum values",
				Pass: true,
				Input: []string{
					`fragment Fragment on Query @arguments(
					role: { type: "UserRole" }
				) {
					usersByRole(role: $role) {
						id
					}
				}`,
					`query Test {
					...Fragment @with(role: ADMIN)
				}`,
				},
			},
			{
				Name: "@with rejects unknown enum values",
				Pass: false,
				Input: []string{
					`fragment Fragment on Query @arguments(
					role: { type: "UserRole" }
				) {
					usersByRole(role: $role) {
						id
					}
				}`,
					`query Test {
					...Fragment @with(role: SUPERADMIN)
				}`,
				},
			},
			{
				Name: "@with rejects strings for enum arguments",
				Pass: false,
				Input: []string{
					`fragment Fragment on Query @arguments(
					role: { type: "UserRole" }
				) {
					usersByRole(role: $role) {
						id
					}
				}`,
					`query Test {
					...Fragment @with(role: "ADMIN")
				}`,
				},
			},
			{
				Name: "@with accepts valid input objects",
				Pass: true,
				Input: []string{
					`fragment Fragment on Query @arguments(
					filter: { type: "UserFilter" }
				) {
					users(filter: $filter) {
						id
					}
				}`,
					`query Test {
					...Fragment @with(filter: { and: [{ firstName: "x" }] })
				}`,
				},
			},
			{
				Name: "@with rejects unknown fields on input objects",
				Pass: false,
				Input: []string{
					`fragment Fragment on Query @arguments(
					filter: { type: "UserFilter" }
				) {
					users(filter: $filter) {
						id
					}
				}`,
					`query Test {
					...Fragment @with(filter: { bogus: "x" })
				}`,
				},
			},
			{
				Name: "@with providing all required arguments passes validation",
				Pass: true,
				Input: []string{
					`fragment Fragment on User @arguments(
					limit: { type: "Int!" }
				) {
					friends(limit: $limit) { id }
				}`,
					`query Test {
					user(name: "foo") {
						...Fragment @with(limit: 10)
					}
				}`,
				},
			},
			{
				Name: "@with omitting a required argument fails validation",
				Pass: false,
				Input: []string{
					`fragment Fragment on User @arguments(
					limit: { type: "Int!" },
					offset: { type: "Int" }
				) {
					friends(limit: $limit, offset: $offset) { id }
				}`,
					`query Test {
					user(name: "foo") {
						...Fragment @with(offset: 5)
					}
				}`,
				},
			},
			{
				Name: "@with omitting a required String! argument fails validation",
				Pass: false,
				Input: []string{
					`fragment Fragment on User @arguments(
					name: { type: "String!" },
					limit: { type: "Int" }
				) {
					friends(name: $name, limit: $limit) { id }
				}`,
					`query Test {
					user(name: "foo") {
						...Fragment @with(limit: 10)
					}
				}`,
				},
			},
			{
				Name: "optional fragment argument with default can be passed explicitly via @with",
				Pass: true,
				Input: []string{
					`fragment Fragment on User @arguments(
					limit: { type: "Int", default: 10 }
				) {
					friends(limit: $limit) { id }
				}`,
					`query Test {
					user(name: "foo") {
						...Fragment @with(limit: 5)
					}
				}`,
				},
			},
			{
				Name: "spreading without @with when all args have defaults passes validation",
				Pass: true,
				Input: []string{
					`fragment Fragment on User @arguments(
					limit: { type: "Int", default: 10 },
					offset: { type: "Int", default: 0 }
				) {
					friends(limit: $limit, offset: $offset) { id }
				}`,
					`query Test {
					user(name: "foo") {
						...Fragment
					}
				}`,
				},
			},
			{
				Name: "required argument alongside optional default — required must be passed",
				Pass: false,
				Input: []string{
					`fragment Fragment on User @arguments(
					limit: { type: "Int!" },
					offset: { type: "Int", default: 0 }
				) {
					friends(limit: $limit, offset: $offset) { id }
				}`,
					`query Test {
					user(name: "foo") {
						...Fragment @with(offset: 5)
					}
				}`,
				},
			},
			{
				Name: "required argument alongside optional default — passing only required is valid",
				Pass: true,
				Input: []string{
					`fragment Fragment on User @arguments(
					limit: { type: "Int!" },
					offset: { type: "Int", default: 0 }
				) {
					friends(limit: $limit, offset: $offset) { id }
				}`,
					`query Test {
					user(name: "foo") {
						...Fragment @with(limit: 10)
					}
				}`,
				},
			},
			{
				Name: "@with rejects mistyped fields nested in input objects",
				Pass: false,
				Input: []string{
					`fragment Fragment on Query @arguments(
					filter: { type: "UserFilter" }
				) {
					users(filter: $filter) {
						id
					}
				}`,
					`query Test {
					...Fragment @with(filter: { and: [{ firstName: 1 }] })
				}`,
				},
			},
			{
				Name: "@with accepts configured custom scalar inputs",
				Pass: true,
				Input: []string{
					`fragment Fragment on Query @arguments(
					birthday: { type: "Date" }
				) {
					user(name: "foo", birthday: $birthday) {
						id
					}
				}`,
					`query Test {
					...Fragment @with(birthday: "2024-01-01")
				}`,
				},
			},
			{
				Name: "@with rejects custom scalar inputs outside the config",
				Pass: false,
				Input: []string{
					`fragment Fragment on Query @arguments(
					birthday: { type: "Date" }
				) {
					user(name: "foo", birthday: $birthday) {
						id
					}
				}`,
					`query Test {
					...Fragment @with(birthday: true)
				}`,
				},
			},
			{
				Name: "Variables cannot use unknown types",
				Pass: false,
				Input: []string{
					`query Test($name: NotARealType!) {
					user(name: $name) {
						id
					}
				}`,
				},
			},
			{
				Name: "Fragment arguments cannot use unknown types",
				Pass: false,
				Input: []string{
					`fragment Fragment on Query @arguments(
					ids: { type: "NotARealType" }
				) {
					nodes(ids: $ids) {
						id
					}
				}`,
					`query Test {
					...Fragment @with(ids: "A")
				}`,
				},
			},
			{
				Name: "Variables with unknown types are caught even when only passed through @with",
				Pass: false,
				Input: []string{
					`fragment Fragment on Query @arguments(
					ids: { type: "[ID!]!" }
				) {
					nodes(ids: $ids) {
						id
					}
				}`,
					`query Test($ids: NotARealType) {
					...Fragment @with(ids: $ids)
				}`,
				},
			},
			{
				Name: "Variables can use runtime scalar types",
				Pass: true,
				Input: []string{
					`query Test($id: ViewerIDFromSession!) {
					node(id: $id) {
						id
					}
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
				Name: "Valid arguments on interfaces",
				Pass: true,
				Input: []string{
					`fragment WithFriends on HasFriends {
						friends(offset: 10) {
							id
						}
					}`,
				},
			},
			{
				Name: "Invalid arguments on interfaces",
				Pass: false,
				Input: []string{
					`fragment WithFriends on HasFriends {
						friends(foo: 10) {
							id
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
				Name: "Int as ID",
				Pass: true,
				Input: []string{
					`
					mutation Bar {
						deleteUser(id: 2) {
							userID
						}
					}
				`,
				},
			},
			{
				Name: "Scalar input type as valid argument",
				Pass: true,
				Input: []string{
					`
						query UserInfo {
							user(name: "foo", birthday: "2020-01-01") {
								id
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
				Name: "Object can be coerced as list type",
				Pass: true,
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
				Name: "Assigning invalid object to list in deeply nested argument",
				Pass: false,
				Input: []string{
					`
					query UserInfo($name: String) {
						users (filters: { foo: [{ hasFriendWith: { firstName: $name }}] }) {
							id
						}
					}
				`,
				},
			},
			{
				Name: "component fields with arguments",
				Pass: true,
				Input: []string{
					`query MyQuery {
						user(name:"foo") {
							Avatar(size: 10)
						}
					}`,
					`
						fragment UserAvatar on User @componentField(field: "Avatar", prop:"foo") @arguments(size: {type: "Int"}) {
							avatarURL(size: $size)
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
						...Foo @with(name: "hello")
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
				Name: "@paginate offset happy path",
				Pass: true,
				Input: []string{
					`
					fragment UserList on Query {
						users(limit: 10) @paginate {
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
				Name: "single values passed to list fragment arguments are coerced",
				Pass: true,
				Input: []string{
					`
					fragment Fragment on Query @arguments(
						ids: { type: "[ID!]!" }
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
				Name: "@paginate with edges hidden behind a fragment spread",
				Pass: true,
				Input: []string{
					`
					fragment UserPaginatedThroughSpread on User {
						friendsConnection(first: 10) @paginate {
							...ConnectionInfo
						}
					}
				`,
					`
					fragment ConnectionInfo on UserConnection {
						edges {
							node {
								id
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
				Name: "@refetchable on a Node type (happy path)",
				Pass: true,
				Input: []string{
					`
					fragment RefetchableOnNode on User @refetchable {
						firstName
					}
				`,
				},
			},
			{
				Name: "@refetchable on a non-Node type that has a resolve query (happy path)",
				Pass: true,
				Input: []string{
					`
					fragment RefetchableOnCat on Cat @refetchable {
						name
					}
				`,
				},
			},
			{
				Name: "@refetchable on a type that is not a Node and has no resolve query",
				Pass: false,
				Input: []string{
					`
					fragment RefetchableOnGhost on Ghost @refetchable {
						name
					}
				`,
				},
			},
			{
				Name: "@refetchable on Query is not allowed (queries are refetchable by default)",
				Pass: false,
				Input: []string{
					`
					fragment RefetchableOnQuery on Query @refetchable {
						rootScalar
					}
				`,
				},
			},
			{
				Name: "@refetchable and @paginate on the same document is not allowed",
				Pass: false,
				Input: []string{
					`
					fragment RefetchableAndPaginated on User @refetchable {
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
				Name: "null fragment arguments with default value passed to non-null field",
				Pass: true,
				Input: []string{
					`
					fragment UserPaginatedA on Query @arguments(name: { type: "String", default: "foo" }) {
						user(name: $name) {
							id
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
			{
				Name: "Concrete fragment on an abstract parent",
				Pass: true,
				Input: []string{
					`fragment frag on User {
				   id
			   }`,
					`query A {
            node(id:"1") {
					    ...frag
				    }
			   }`,
				},
			},
			{
				Name: "@refetch on an object field (positive)",
				Pass: true,
				Input: []string{
					`mutation RefetchFriend {
						addFriend {
							friend @refetch {
								firstName
							}
						}
					}`,
				},
			},
			{
				Name: "@refetch in a subscription (positive)",
				Pass: true,
				Input: []string{
					`subscription RefetchSub {
						userUpdate @refetch {
							id
						}
					}`,
				},
			},
			{
				Name: "@refetch outside a mutation (negative)",
				Pass: false,
				Input: []string{
					`query RefetchQuery {
						user(name: "foo") {
							bestFriend @refetch {
								id
							}
						}
					}`,
				},
			},
			{
				Name: "@refetch on a scalar field (negative)",
				Pass: false,
				Input: []string{
					`mutation RefetchScalar {
						addFriend {
							friend {
								firstName @refetch
							}
						}
					}`,
				},
			},
			{
				Name: "@refetch on an abstract field (positive)",
				Pass: true,
				Input: []string{
					`mutation RefetchNode {
						updateNode @refetch {
							id
						}
					}`,
				},
			},
			{
				Name: "@refetch on a plain list field (positive)",
				Pass: true,
				Input: []string{
					`mutation RefetchList {
						addFriend {
							friend {
								friends @refetch {
									id
								}
							}
						}
					}`,
				},
			},
			{
				Name: "@refetch combined with @paginate (negative)",
				Pass: false,
				Input: []string{
					`mutation RefetchAndPaginate {
						addFriend {
							friend {
								believers @refetch @paginate {
									edges {
										node {
											id
										}
									}
								}
							}
						}
					}`,
				},
			},
			{
				Name: "@plural fragment spread on a list field (positive)",
				Pass: true,
				Input: []string{
					`fragment PluralRow on User @plural {
						firstName
					}`,
					`query PluralQuery {
						users(limit: 10) {
							...PluralRow
						}
					}`,
				},
			},
			{
				Name: "@plural fragment spread on a non-list field (negative)",
				Pass: false,
				Input: []string{
					`fragment PluralRow on User @plural {
						firstName
					}`,
					`query PluralQuery {
						user(name: "foo") {
							...PluralRow
						}
					}`,
				},
			},
			{
				Name: "@plural combined with @paginate (negative)",
				Pass: false,
				Input: []string{
					`fragment PluralPaginated on User @plural {
						believers @paginate {
							edges {
								node {
									id
								}
							}
						}
					}`,
				},
			},
			{
				Name: "@endpoint on a mutation with a valid relative redirect and leaf path (positive)",
				Pass: true,
				Input: []string{
					`mutation AddFriendForm @endpoint(redirect: "/users/{ addFriend.friend.id }") {
						addFriend { friend { id } }
					}`,
				},
			},
			{
				Name: "@endpoint without a redirect (positive)",
				Pass: true,
				Input: []string{
					`mutation AddFriendForm @endpoint {
						addFriend { friend { id } }
					}`,
				},
			},
			{
				Name: "@endpoint on a query (negative)",
				Pass: false,
				Input: []string{
					`query Whoami @endpoint {
						user(name: "x") { id }
					}`,
				},
			},
			{
				Name: "@endpoint redirect with an absolute URL (negative)",
				Pass: false,
				Input: []string{
					`mutation AddFriendForm @endpoint(redirect: "https://evil.com/users") {
						addFriend { friend { id } }
					}`,
				},
			},
			{
				Name: "@endpoint redirect with a protocol-relative URL (negative)",
				Pass: false,
				Input: []string{
					`mutation AddFriendForm @endpoint(redirect: "//evil.com/users") {
						addFriend { friend { id } }
					}`,
				},
			},
			{
				Name: "@endpoint redirect without a leading slash (negative)",
				Pass: false,
				Input: []string{
					`mutation AddFriendForm @endpoint(redirect: "users/new") {
						addFriend { friend { id } }
					}`,
				},
			},
			{
				Name: "@endpoint redirect path missing from the selection set (negative)",
				Pass: false,
				Input: []string{
					`mutation AddFriendForm @endpoint(redirect: "/users/{ addFriend.friend.nope }") {
						addFriend { friend { id } }
					}`,
				},
			},
			{
				Name: "@endpoint redirect path resolving to an object (negative)",
				Pass: false,
				Input: []string{
					`mutation AddFriendForm @endpoint(redirect: "/users/{ addFriend.friend }") {
						addFriend { friend { id } }
					}`,
				},
			},
			{
				Name: "@endpoint fields entry matching a variable (positive)",
				Pass: true,
				Input: []string{
					`mutation UpdateForm($input: InputType) @endpoint(fields: ["input"]) {
						update(input: $input)
					}`,
				},
			},
			{
				Name: "@endpoint fields nested path on a real variable (positive)",
				Pass: true,
				Input: []string{
					`mutation UpdateForm($input: InputType) @endpoint(fields: ["input.field"]) {
						update(input: $input)
					}`,
				},
			},
			{
				Name: "@endpoint fields entry not matching any variable (negative)",
				Pass: false,
				Input: []string{
					`mutation UpdateForm($input: InputType) @endpoint(fields: ["nope"]) {
						update(input: $input)
					}`,
				},
			},
			{
				Name: "@session path resolving to an object (positive)",
				Pass: true,
				Input: []string{
					`mutation LoginForm @session(path: "addFriend.friend") {
						addFriend { friend { id } }
					}`,
				},
			},
			{
				Name: "@session path resolving to a scalar (negative)",
				Pass: false,
				Input: []string{
					`mutation LoginForm @session(path: "addFriend.friend.id") {
						addFriend { friend { id } }
					}`,
				},
			},
			{
				Name: "@session path missing from the selection set (negative)",
				Pass: false,
				Input: []string{
					`mutation LoginForm @session(path: "addFriend.nope") {
						addFriend { friend { id } }
					}`,
				},
			},
			{
				Name: "@session without a path (negative)",
				Pass: false,
				Input: []string{
					`mutation LoginForm @session {
						addFriend { friend { id } }
					}`,
				},
			},
			{
				Name: "@session on a query (negative)",
				Pass: false,
				Input: []string{
					`query Whoami @session(path: "user") {
						user(name: "x") { id }
					}`,
				},
			},
		},
	})
}
